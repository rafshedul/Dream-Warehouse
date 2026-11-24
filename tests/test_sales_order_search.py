import pytest

from app.core.roles import UserRole
from app.models.invoice import Invoice
from app.models.sales_order import SalesOrder
from app.models.shipment import Shipment
from app.models.transaction import Transaction

from tests.test_auth_roles import add_account, client, sign_in  # noqa: F401
from tests.test_storefront import checkout_body, shop  # noqa: F401


@pytest.fixture
def orders(shop):
    """Two online COD orders (one cancelled later), one online 'paid' order and one internal order."""
    api, session_factory, ids, buyer_other = shop
    add_account(session_factory, "staff@example.com", UserRole.STAFF)
    add_account(session_factory, "admin@example.com", UserRole.ADMIN)

    sign_in(api, "buyer@example.com")
    cod = api.post("/storefront/checkout", json=checkout_body([{"product_id": ids["pen"], "quantity": 2}])).json()["sales_order_id"]
    cancelled = api.post("/storefront/checkout", json=checkout_body([{"product_id": ids["pen"], "quantity": 1}])).json()["sales_order_id"]
    api.post(f"/storefront/orders/{cancelled}/cancel")
    api.post("/logout")

    with session_factory() as db:
        buyer = db.get(SalesOrder, cod)
        paid = SalesOrder(
            contact_id=buyer.contact_id, customer_user_id=buyer.customer_user_id, total_amount=30,
            payment_method="sslcommerz", payment_status="paid", order_status="processing",
            shipping_address="Paid street 9", shipping_phone="01999999999",
        )
        internal = SalesOrder(contact_id=buyer.contact_id, total_amount=5)
        db.add_all([paid, internal])
        db.commit()
        paid_id, internal_id = paid.id, internal.id
    return api, session_factory, {"cod": cod, "cancelled": cancelled, "paid": paid_id, "internal": internal_id, **ids}


def rows(response):
    assert response.status_code == 200, response.text
    return {row["id"]: row for row in response.json()["orders"]}


def test_search_requires_staff_role(orders):
    api, *_ = orders
    assert api.get("/sales-orders/search").status_code == 401
    sign_in(api, "buyer@example.com")
    assert api.get("/sales-orders/search").status_code == 403
    assert api.get("/sales-orders/1/detail").status_code == 403


def test_views_and_filters(orders):
    api, _, o = orders
    sign_in(api, "staff@example.com")
    assert set(rows(api.get("/sales-orders/search"))) == {o["cod"], o["cancelled"], o["paid"], o["internal"]}
    assert set(rows(api.get("/sales-orders/search?view=online"))) == {o["cod"], o["cancelled"], o["paid"]}
    assert set(rows(api.get("/sales-orders/search?source=internal"))) == {o["internal"]}
    assert set(rows(api.get("/sales-orders/search?view=unpaid"))) == {o["cod"]}  # COD still to collect; cancelled excluded
    assert set(rows(api.get("/sales-orders/search?view=to_ship"))) == {o["cod"], o["paid"]}
    assert set(rows(api.get("/sales-orders/search?view=cancelled"))) == {o["cancelled"]}
    assert set(rows(api.get("/sales-orders/search?payment_status=paid"))) == {o["paid"]}
    assert set(rows(api.get("/sales-orders/search?payment_method=cod&order_status=processing"))) == {o["cod"]}
    counts = api.get("/sales-orders/search").json()["counts"]
    assert counts["all"] == 4 and counts["online"] == 3 and counts["to_ship"] == 2 and counts["cancelled"] == 1
    assert api.get("/sales-orders/search?view=bogus").status_code == 422


def test_text_search_by_number_name_and_phone(orders):
    api, _, o = orders
    sign_in(api, "staff@example.com")
    assert set(rows(api.get(f"/sales-orders/search?q=SO-{o['paid']:06d}"))) == {o["paid"]}
    assert set(rows(api.get(f"/sales-orders/search?q={o['cod']}"))) >= {o["cod"]}
    assert set(rows(api.get("/sales-orders/search?q=01999999999"))) == {o["paid"]}
    assert set(rows(api.get("/sales-orders/search?q=buyer"))) == {o["cod"], o["cancelled"], o["paid"], o["internal"]}
    assert rows(api.get("/sales-orders/search?q=nobody-by-this-name")) == {}


def test_pagination_newest_first(orders):
    api, _, o = orders
    sign_in(api, "staff@example.com")
    page1 = api.get("/sales-orders/search?limit=3&page=1").json()
    page2 = api.get("/sales-orders/search?limit=3&page=2").json()
    assert page1["total"] == 4 and page1["total_pages"] == 2
    assert [r["id"] for r in page1["orders"]] == sorted([r["id"] for r in page1["orders"]], reverse=True)
    assert len(page1["orders"]) == 3 and len(page2["orders"]) == 1
    assert api.get("/sales-orders/search?limit=500").status_code == 422


def test_detail_shows_customer_items_shipment_and_invoice_to_staff(orders):
    api, session_factory, o = orders
    with session_factory() as db:
        order = db.get(SalesOrder, o["cod"])
        db.add(Shipment(sales_order_id=order.id, warehouse_id=o["w1"], contact_id=order.contact_id, tracking_number="TRK-1", status="pending"))
        txn = Transaction(contact_id=order.contact_id, sales_order_id=order.id, amount=20, status="paid")
        db.add(txn)
        db.flush()
        db.add(Invoice(user_id=order.customer_user_id, sales_order_id=order.id, transaction_id=txn.id))
        db.commit()
    sign_in(api, "staff@example.com")
    detail = api.get(f"/sales-orders/{o['cod']}/detail").json()
    assert detail["source"] == "online" and detail["order_number"] == f"SO-{o['cod']:06d}"
    assert detail["customer_email"] == "buyer@example.com"
    assert detail["shipping_address"] == "House 1, Road 2, Bhola" and detail["shipping_phone"] == "01700000000"
    assert detail["items"][0]["product_name"] == "Pen <b>" and detail["items"][0]["quantity"] == 2
    assert detail["shipment"]["tracking_number"] == "TRK-1" and detail["shipment"]["warehouse_name"] == "W1"
    assert detail["fulfillment_warehouse_name"] == "W1"
    assert detail["invoice_number"].startswith("INV-")
    assert api.get("/sales-orders/999999/detail").status_code == 404
    internal = api.get(f"/sales-orders/{o['internal']}/detail").json()
    assert internal["source"] == "internal" and internal["shipment"] is None and internal["items"] == []
