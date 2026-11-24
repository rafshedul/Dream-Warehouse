
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.core.dependencies import require_roles
from app.core.roles import UserRole

from app.models.stock import Stock
from app.models.product import Product
from app.models.warehouse import Warehouse
from app.models.stock_activity import StockActivity

from app.schemas.stock import StockCreate, StockResponse


router = APIRouter(
    prefix="/stocks",
    tags=["Stocks"],
)


# ==================================================
# COMMON ROLE PERMISSION
# ==================================================

STOCK_VIEW_ROLES = [
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.STAFF,
]


# ==================================================
# COMMON STOCK ALERT QUERY
# ==================================================

def get_stock_alerts(db: Session, alert_type: str = "all"):

    total_stock = func.coalesce(
        func.sum(Stock.quantity),
        0
    )

    query = (
        db.query(
            Product.id.label("product_id"),
            Product.name.label("product_name"),
            Product.sku.label("sku"),
            Product.reorder_level.label("reorder_level"),
            total_stock.label("total_stock"),
        )
        .outerjoin(
            Stock,
            Stock.product_id == Product.id
        )
        .group_by(
            Product.id,
            Product.name,
            Product.sku,
            Product.reorder_level,
        )
    )

    # All products with stock at or below reorder level
    if alert_type == "all":
        query = query.having(
            total_stock <= Product.reorder_level
        )

    # Products with stock greater than zero
    # but at or below reorder level
    elif alert_type == "low_stock":
        query = query.having(
            total_stock > 0,
            total_stock <= Product.reorder_level
        )

    # Products with zero stock
    elif alert_type == "out_of_stock":
        query = query.having(
            total_stock == 0
        )

    results = query.order_by(Product.id.asc()).all()

    alerts = []

    for item in results:

        quantity = int(item.total_stock)

        if quantity == 0:
            stock_status = "OUT_OF_STOCK"

        elif quantity <= item.reorder_level:
            stock_status = "LOW_STOCK"

        else:
            stock_status = "IN_STOCK"

        alerts.append({
            "product_id": item.product_id,
            "product_name": item.product_name,
            "sku": item.sku,
            "total_stock": quantity,
            "reorder_level": item.reorder_level,
            "status": stock_status,
        })

    return alerts


# ==================================================
# CREATE STOCK
# Admin only
# New stock always starts with quantity 0
# ==================================================

@router.post(
    "/",
    response_model=StockResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_stock(
    stock_data: StockCreate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([UserRole.ADMIN])
    ),
):
    warehouse = db.get(Warehouse, stock_data.warehouse_id)

    if warehouse is None:
        raise HTTPException(
            status_code=404,
            detail="Warehouse not found.",
        )

    product = db.get(Product, stock_data.product_id)

    if product is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found.",
        )

    existing_stock = (
        db.query(Stock)
        .filter(
            Stock.warehouse_id == stock_data.warehouse_id,
            Stock.product_id == stock_data.product_id,
        )
        .first()
    )

    if existing_stock:
        raise HTTPException(
            status_code=409,
            detail="Stock already exists for this product and warehouse.",
        )

    new_stock = Stock(
        warehouse_id=stock_data.warehouse_id,
        product_id=stock_data.product_id,
        quantity=0,
    )

    try:
        db.add(new_stock)
        db.commit()
        db.refresh(new_stock)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Stock already exists for this product and warehouse.",
        )

    return new_stock


# ==================================================
# GET ALL STOCKS
# Admin, Manager, Staff
# ==================================================

@router.get(
    "/",
    response_model=list[StockResponse],
)
def get_all_stocks(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(STOCK_VIEW_ROLES)
    ),
):
    return (
        db.query(Stock)
        .order_by(Stock.id.asc())
        .all()
    )


# ==================================================
# LOW STOCK + OUT OF STOCK ALERTS
# Admin, Manager, Staff
# ==================================================

@router.get("/alerts/")
def get_all_stock_alerts(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(STOCK_VIEW_ROLES)
    ),
):
    alerts = get_stock_alerts(db, "all")

    return {
        "total_alerts": len(alerts),
        "alerts": alerts,
    }


# ==================================================
# LOW STOCK ALERTS
# Admin, Manager, Staff
# ==================================================

@router.get("/alerts/low-stock")
def get_low_stock_alerts(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(STOCK_VIEW_ROLES)
    ),
):
    alerts = get_stock_alerts(db, "low_stock")

    return {
        "total_alerts": len(alerts),
        "alerts": alerts,
    }


# ==================================================
# OUT OF STOCK ALERTS
# Admin, Manager, Staff
# ==================================================

@router.get("/alerts/out-of-stock")
def get_out_of_stock_alerts(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(STOCK_VIEW_ROLES)
    ),
):
    alerts = get_stock_alerts(db, "out_of_stock")

    return {
        "total_alerts": len(alerts),
        "alerts": alerts,
    }


# ==================================================
# GET STOCK BY WAREHOUSE
# Admin, Manager, Staff
# ==================================================

@router.get(
    "/warehouse/{warehouse_id}",
    response_model=list[StockResponse],
)
def get_warehouse_stocks(
    warehouse_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(STOCK_VIEW_ROLES)
    ),
):
    warehouse = db.get(Warehouse, warehouse_id)

    if warehouse is None:
        raise HTTPException(
            status_code=404,
            detail="Warehouse not found.",
        )

    return (
        db.query(Stock)
        .filter(Stock.warehouse_id == warehouse_id)
        .order_by(Stock.id.asc())
        .all()
    )


# ==================================================
# GET TOTAL STOCK BY PRODUCT
# Admin, Manager, Staff
# ==================================================

@router.get("/product/{product_id}/total")
def get_product_total_stock(
    product_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(STOCK_VIEW_ROLES)
    ),
):
    product = db.get(Product, product_id)

    if product is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found.",
        )

    total_quantity = (
        db.query(
            func.coalesce(func.sum(Stock.quantity), 0)
        )
        .filter(Stock.product_id == product_id)
        .scalar()
    )

    return {
        "product_id": product.id,
        "product_name": product.name,
        "total_quantity": int(total_quantity),
    }


# ==================================================
# GET STOCK BY ID
# Admin, Manager, Staff
# ==================================================

@router.get(
    "/{stock_id}",
    response_model=StockResponse,
)
def get_stock(
    stock_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(STOCK_VIEW_ROLES)
    ),
):
    stock = db.get(Stock, stock_id)

    if stock is None:
        raise HTTPException(
            status_code=404,
            detail="Stock not found.",
        )

    return stock


# ==================================================
# DIRECT STOCK UPDATE DISABLED
# ==================================================

@router.put("/{stock_id}")
def update_stock(
    stock_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([
            UserRole.ADMIN,
            UserRole.MANAGER,
        ])
    ),
):
    raise HTTPException(
        status_code=405,
        detail="Direct stock update is disabled. Use Stock In, Stock Out or Stock Adjustment.",
    )


# ==================================================
# DELETE STOCK
# Admin only
# ==================================================

@router.delete("/{stock_id}")
def delete_stock(
    stock_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([UserRole.ADMIN])
    ),
):
    stock = db.get(Stock, stock_id)

    if stock is None:
        raise HTTPException(
            status_code=404,
            detail="Stock not found.",
        )

    if stock.quantity != 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete stock because quantity is not zero.",
        )

    activity_exists = (
        db.query(StockActivity)
        .filter(
            StockActivity.product_id == stock.product_id,
            StockActivity.warehouse_id == stock.warehouse_id,
        )
        .first()
    )

    if activity_exists:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete stock because activity history exists.",
        )

    db.delete(stock)
    db.commit()

    return {
        "message": "Stock deleted successfully."
    }
