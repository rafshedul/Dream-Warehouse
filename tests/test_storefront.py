from datetime import datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy.orm import sessionmaker

from app.core.roles import UserRole
from app.models.category import Category
from app.models.product import Product
from app.models.sales_order import SalesOrder
from app.models.stock import Stock
from app.models.stock_activity import StockActivity
from app.models.transaction import Transaction
from app.models.warehouse import Warehouse
from app.routers import payment as payment_router
from app.routers import storefront as storefront_router
from app.services.order_inventory import expire_unpaid_online_orders

from tests.test_auth_roles import add_account, client, sign_in  # noqa: F401


@pytest.fixture
def shop(client):
    api, session_factory = client
    with session_factory() as db:
        category = Category(name="Cat")
        w1, w2 = Warehouse(name="W1", location="x"), Warehouse(name="W2", location="y")
        db.add_all([category, w1, w2])
        db.flush()
        pen = Product(category_id=category.id, sku="PEN", name="Pen <b>", unit_price=Decimal("10.00"))
        ink = Product(category_id=category.id, sku="INK", name="Ink", unit_price=Decimal("25.50"))
        db.add_all([pen, ink])
        db.flush()
        db.add_all([
            Stock(warehouse_id=w1.id, product_id=pen.id, quantity=10),
            Stock(warehouse_id=w1.id, product_id=ink.id, quantity=2),
            Stock(warehouse_id=w2.id, product_id=ink.id, quantity=50),
        ])
        db.commit()
        ids = {"pen": pen.id, "ink": ink.id, "w1": w1.id}
    add_account(session_factory, "buyer@example.com", UserRole.USER)
    other = add_account(session_factory, "other@example.com", UserRole.USER)
    return api, session_factory, ids, other


def checkout_body(items, method="cod"):
    return {
        "items": items,
        "shipping_address": "House 1, Road 2, Bhola",
        "shipping_phone": "01700000000",
        "payment_method": method,
    }


def stock_qty(session_factory, product_id, warehouse_id):
    with session_factory() as db:
        return db.query(Stock).filter_by(product_id=product_id, warehouse_id=warehouse_id).one().quantity


def test_cart_validate_is_public_and_uses_server_prices(shop):
    api, _, ids, _ = shop
    result = api.post("/storefront/cart/validate", json={"items": [
        {"product_id": ids["pen"], "quantity": 3}, {"product_id": ids["ink"], "quantity": 60},
    ]})
    assert result.status_code == 200
    body = result.json()
    lines = {line["product_id"]: line for line in body["items"]}
    assert lines[ids["pen"]]["unit_price"] == 10.0 and lines[ids["pen"]]["available"] == 10
    assert lines[ids["ink"]]["available"] == 52
    assert body["fulfillable"] is False  # 60 ink does not fit in any single warehouse
    assert api.post("/storefront/cart/validate", json={"items": [{"product_id": 9999, "quantity": 1}]}).json()["items"][0]["exists"] is False


def test_checkout_requires_customer_login(shop):
    api, *_ = shop
    assert api.post("/storefront/checkout", json=checkout_body([{"product_id": 1, "quantity": 1}])).status_code == 401


def test_cod_checkout_reserves_stock_and_ignores_client_prices(shop):
    api, session_factory, ids, _ = shop
    sign_in(api, "buyer@example.com")
    body = checkout_body([{"product_id": ids["pen"], "quantity": 4}, {"product_id": ids["pen"], "quantity": 1}])
    body["items"][0]["unit_price"] = 0.01  # must be ignored
    result = api.post("/storefront/checkout", json=body)
    assert result.status_code == 201, result.text
    assert result.json()["amount"] == 50.0  # 5 x 10.00, server price
    assert result.json()["payment_status"] == "due"
    assert stock_qty(session_factory, ids["pen"], ids["w1"]) == 5
    with session_factory() as db:
        assert db.query(StockActivity).filter_by(movement_type="OUT").count() == 1
    orders = api.get("/storefront/orders").json()
    assert len(orders) == 1 and orders[0]["items"][0]["quantity"] == 5


def test_checkout_rejects_insufficient_stock_without_changes(shop):
    api, session_factory, ids, _ = shop
    sign_in(api, "buyer@example.com")
    result = api.post("/storefront/checkout", json=checkout_body([{"product_id": ids["pen"], "quantity": 11}]))
    assert result.status_code == 409
    assert stock_qty(session_factory, ids["pen"], ids["w1"]) == 10
    assert api.get("/storefront/orders").json() == []


def test_checkout_needs_a_single_warehouse_for_the_whole_cart(shop):
    api, _, ids, _ = shop
    sign_in(api, "buyer@example.com")
    # pen only in W1 (10), ink 50 only fits W2 -> no single warehouse holds both
    result = api.post("/storefront/checkout", json=checkout_body([
        {"product_id": ids["pen"], "quantity": 1}, {"product_id": ids["ink"], "quantity": 20},
    ]))
    assert result.status_code == 409


def test_customer_cannot_see_or_cancel_another_customers_order(shop):
    api, _, ids, _ = shop
    sign_in(api, "buyer@example.com")
    order_id = api.post("/storefront/checkout", json=checkout_body([{"product_id": ids["pen"], "quantity": 1}])).json()["sales_order_id"]
    api.post("/logout")
    sign_in(api, "other@example.com")
    assert api.get(f"/storefront/orders/{order_id}").status_code == 404
    assert api.post(f"/storefront/orders/{order_id}/cancel").status_code == 404


def test_cancel_releases_stock_once(shop):
    api, session_factory, ids, _ = shop
    sign_in(api, "buyer@example.com")
    order_id = api.post("/storefront/checkout", json=checkout_body([{"product_id": ids["pen"], "quantity": 4}])).json()["sales_order_id"]
    assert stock_qty(session_factory, ids["pen"], ids["w1"]) == 6
    assert api.post(f"/storefront/orders/{order_id}/cancel").json()["order_status"] == "cancelled"
    assert stock_qty(session_factory, ids["pen"], ids["w1"]) == 10
    assert api.post(f"/storefront/orders/{order_id}/cancel").status_code == 409
    assert stock_qty(session_factory, ids["pen"], ids["w1"]) == 10


def test_unpaid_online_orders_expire_and_release_stock(shop):
    api, session_factory, ids, _ = shop
    sign_in(api, "buyer@example.com")
    # create an online order directly (gateway is not reachable in tests)
    with session_factory() as db:
        user_id = api.get("/auth/me").json()["user_id"]
        from app.models.user import User
        user = db.get(User, user_id)
        stock = db.query(Stock).filter_by(product_id=ids["pen"], warehouse_id=ids["w1"]).one()
        stock.quantity -= 3
        order = SalesOrder(
            contact_id=user.contact_id, created_by=user.id, customer_user_id=user.id,
            fulfillment_warehouse_id=ids["w1"], total_amount=30, payment_method="sslcommerz",
            payment_status="pending", order_status="processing",
            created_at=datetime.utcnow() - timedelta(minutes=45),
        )
        db.add(order)
        db.flush()
        from app.models.sales_order_item import SalesOrderItem
        db.add(SalesOrderItem(product_id=ids["pen"], sales_order_id=order.id, quantity=3, unit_price=10, total_price=30))
        db.add(Transaction(contact_id=user.contact_id, sales_order_id=order.id, amount=30, status="initiated", gateway_tran_id="T1"))
        db.commit()
        assert expire_unpaid_online_orders(db, 30) == 1
        assert expire_unpaid_online_orders(db, 30) == 0
    assert stock_qty(session_factory, ids["pen"], ids["w1"]) == 10
    order = api.get("/storefront/orders").json()[0]
    assert order["order_status"] == "cancelled" and order["payment_status"] == "expired"


def test_late_payment_after_expiry_retakes_stock_or_flags_refund(shop, monkeypatch):
    api, session_factory, ids, _ = shop
    sign_in(api, "buyer@example.com")
    from app.models.sales_order_item import SalesOrderItem
    from app.models.user import User
    with session_factory() as db:
        user = db.get(User, api.get("/auth/me").json()["user_id"])
        orders = []
        for tran, qty in (("LATE1", 3), ("LATE2", 3)):
            order = SalesOrder(
                contact_id=user.contact_id, created_by=user.id, customer_user_id=user.id,
                fulfillment_warehouse_id=ids["w1"], total_amount=qty * 10, payment_method="sslcommerz",
                payment_status="expired", order_status="cancelled", stock_released=True,
            )
            db.add(order)
            db.flush()
            db.add(SalesOrderItem(product_id=ids["pen"], sales_order_id=order.id, quantity=qty, unit_price=10, total_price=qty * 10))
            db.add(Transaction(contact_id=user.contact_id, sales_order_id=order.id, amount=qty * 10, status="expired", gateway_tran_id=tran))
            orders.append(order.id)
        stock = db.query(Stock).filter_by(product_id=ids["pen"], warehouse_id=ids["w1"]).one()
        stock.quantity = 4  # enough for one late payment, not both
        db.commit()

    async def fake_validate(tran_id, val_id):
        return {"status": "VALID", "tran_id": tran_id, "currency": "BDT", "amount": "30.00", "val_id": val_id}

    monkeypatch.setattr(payment_router, "_validate_payment", fake_validate)
    first = api.post("/payments/sslcommerz/success", data={"tran_id": "LATE1", "val_id": "v1"}, follow_redirects=False)
    second = api.post("/payments/sslcommerz/success", data={"tran_id": "LATE2", "val_id": "v2"}, follow_redirects=False)
    assert first.status_code == second.status_code == 303 and "status=success" in first.headers["location"]
    assert stock_qty(session_factory, ids["pen"], ids["w1"]) == 1
    states = {o["id"]: o for o in api.get("/storefront/orders").json()}
    assert states[orders[0]]["order_status"] == "processing" and states[orders[0]]["payment_status"] == "paid"
    assert states[orders[1]]["order_status"] == "refund_required"


def test_gateway_error_on_return_redirects_instead_of_showing_json(shop, monkeypatch):
    api, *_ = shop

    async def boom(tran_id, val_id):
        raise RuntimeError("gateway down")

    monkeypatch.setattr(payment_router, "_validate_payment", boom)
    response = api.post("/payments/sslcommerz/success", data={"tran_id": "NOPE", "val_id": "x"}, follow_redirects=False)
    assert response.status_code == 303 and "status=unverified" in response.headers["location"]


def test_online_payment_unavailable_without_credentials(shop, monkeypatch):
    api, _, ids, _ = shop
    monkeypatch.setattr(storefront_router, "sslcommerz_configured", lambda: False)
    sign_in(api, "buyer@example.com")
    result = api.post("/storefront/checkout", json=checkout_body([{"product_id": ids["pen"], "quantity": 1}], method="sslcommerz"))
    assert result.status_code == 503
