
from datetime import datetime, timedelta, timezone
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, case
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.stock_activity import StockActivity
from app.models.stock import Stock
from app.models.user import User

from app.schemas.stock_activity import (
    StockActivityCreate,
    StockActivityResponse,
)

from app.core.dependencies import require_roles
from app.core.roles import UserRole


router = APIRouter(
    prefix="/stock-activities",
    tags=["Stock Activities"],
)


# --------------------------------------------------
# Helper: Apply Stock Movement
# --------------------------------------------------

def apply_stock_movement(
    db: Session,
    product_id: int,
    warehouse_id: int,
    quantity: int,
    movement_type: str,
):
    stock = (
        db.query(Stock)
        .filter(
            Stock.product_id == product_id,
            Stock.warehouse_id == warehouse_id,
        )
        .with_for_update()
        .first()
    )

    # Stock record does not exist
    if stock is None:
        if movement_type == "OUT":
            raise HTTPException(
                status_code=400,
                detail="Insufficient stock. Stock record does not exist.",
            )

        stock = Stock(
            product_id=product_id,
            warehouse_id=warehouse_id,
            quantity=0,
        )

        db.add(stock)
        db.flush()

    # Stock In
    if movement_type == "IN":
        stock.quantity += quantity

    # Stock Out
    elif movement_type == "OUT":

        if stock.quantity < quantity:
            raise HTTPException(
                status_code=400,
                detail="Insufficient stock quantity.",
            )

        stock.quantity -= quantity

    else:
        raise HTTPException(
            status_code=400,
            detail="Invalid movement type.",
        )

    return stock


# --------------------------------------------------
# Create Stock Activity: Admin only
# --------------------------------------------------

@router.post(
    "/",
    response_model=StockActivityResponse,
    status_code=201,
)
def create_stock_activity(
    data: StockActivityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([UserRole.ADMIN])
    ),
):
    try:
        apply_stock_movement(
            db=db,
            product_id=data.product_id,
            warehouse_id=data.warehouse_id,
            quantity=data.quantity,
            movement_type=data.movement_type,
        )

        activity = StockActivity(
            product_id=data.product_id,
            warehouse_id=data.warehouse_id,
            quantity=data.quantity,
            date=data.date or datetime.utcnow(),
            movement_type=data.movement_type,
            created_by=current_user.id,
        )

        db.add(activity)

        db.commit()
        db.refresh(activity)

        return activity

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail="Invalid product_id or warehouse_id.",
        )

    except Exception:
        db.rollback()
        raise


# --------------------------------------------------
# View Stock Activities
# Admin + Manager + Staff
# Filters + Pagination
# --------------------------------------------------

@router.get("/")
def get_stock_activities(
    product_id: int | None = Query(default=None, gt=0),
    warehouse_id: int | None = Query(default=None, gt=0),

    movement_type: str | None = Query(
        default=None,
        pattern="^(IN|OUT|ADJUSTMENT)$",
    ),

    start_date: datetime | None = None,
    end_date: datetime | None = None,

    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),

    db: Session = Depends(get_db),

    current_user=Depends(
        require_roles([
            UserRole.ADMIN,
            UserRole.MANAGER,
            UserRole.STAFF,
        ])
    ),
):
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="start_date cannot be greater than end_date.",
        )

    query = db.query(StockActivity)

    if product_id is not None:
        query = query.filter(
            StockActivity.product_id == product_id
        )

    if warehouse_id is not None:
        query = query.filter(
            StockActivity.warehouse_id == warehouse_id
        )

    if movement_type is not None:
        query = query.filter(
            StockActivity.movement_type == movement_type
        )

    if start_date is not None:
        query = query.filter(
            StockActivity.date >= start_date
        )

    if end_date is not None:
        query = query.filter(
            StockActivity.date <= end_date
        )

    total_items = query.order_by(None).with_entities(
        func.count(StockActivity.id)
    ).scalar()

    total_pages = ceil(total_items / limit) if total_items else 0

    offset = (page - 1) * limit

    activities = (
        query
        .order_by(StockActivity.date.desc(), StockActivity.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "total_items": total_items,
        "total_pages": total_pages,
        "current_page": page,
        "limit": limit,
        "activities": activities,
    }


# --------------------------------------------------
# Stock Reports Helper
# --------------------------------------------------

def generate_stock_report(
    db: Session,
    start_date: datetime,
    end_date: datetime,
):
    result = (
        db.query(
            func.count(StockActivity.id).label("total_activities"),

            func.coalesce(
                func.sum(
                    case(
                        (
                            StockActivity.movement_type == "IN",
                            StockActivity.quantity,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("total_in"),

            func.coalesce(
                func.sum(
                    case(
                        (
                            StockActivity.movement_type == "OUT",
                            StockActivity.quantity,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("total_out"),

            func.coalesce(
                func.sum(
                    case(
                        (
                            StockActivity.movement_type == "ADJUSTMENT",
                            StockActivity.quantity,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("total_adjustment"),
        )
        .filter(
            StockActivity.date >= start_date,
            StockActivity.date < end_date,
        )
        .first()
    )

    total_in = int(result.total_in)
    total_out = int(result.total_out)
    total_adjustment = int(result.total_adjustment)

    return {
        "total_activities": result.total_activities,
        "total_in": total_in,
        "total_out": total_out,
        "total_adjustment": total_adjustment,
        "net_movement": total_in - total_out + total_adjustment,
    }


# Bangladesh timezone
BD_TZ = timezone(timedelta(hours=6))


def to_utc_naive(local_datetime: datetime) -> datetime:
    return (
        local_datetime
        .astimezone(timezone.utc)
        .replace(tzinfo=None)
    )


# --------------------------------------------------
# Daily Stock Report
# --------------------------------------------------

@router.get("/reports/daily")
def daily_stock_report(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([
            UserRole.ADMIN,
            UserRole.MANAGER,
            UserRole.STAFF,
        ])
    ),
):
    now = datetime.now(BD_TZ)

    start_local = now.replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )

    end_local = start_local + timedelta(days=1)

    start_utc = to_utc_naive(start_local)
    end_utc = to_utc_naive(end_local)

    return {
        "report_type": "daily",
        "report_date": start_local.date(),
        **generate_stock_report(
            db,
            start_utc,
            end_utc,
        ),
    }


# --------------------------------------------------
# Weekly Stock Report
# Last 7 calendar days including today
# --------------------------------------------------

@router.get("/reports/weekly")
def weekly_stock_report(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([
            UserRole.ADMIN,
            UserRole.MANAGER,
            UserRole.STAFF,
        ])
    ),
):
    now = datetime.now(BD_TZ)

    end_local = now.replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    ) + timedelta(days=1)

    start_local = end_local - timedelta(days=7)

    start_utc = to_utc_naive(start_local)
    end_utc = to_utc_naive(end_local)

    return {
        "report_type": "weekly",
        "start_date": start_local.date(),
        "end_date": (end_local - timedelta(days=1)).date(),
        **generate_stock_report(
            db,
            start_utc,
            end_utc,
        ),
    }


# --------------------------------------------------
# Monthly Stock Report
# Current calendar month
# --------------------------------------------------

@router.get("/reports/monthly")
def monthly_stock_report(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([
            UserRole.ADMIN,
            UserRole.MANAGER,
            UserRole.STAFF,
        ])
    ),
):
    now = datetime.now(BD_TZ)

    start_local = now.replace(
        day=1,
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )

    if start_local.month == 12:
        end_local = start_local.replace(
            year=start_local.year + 1,
            month=1,
        )
    else:
        end_local = start_local.replace(
            month=start_local.month + 1,
        )

    start_utc = to_utc_naive(start_local)
    end_utc = to_utc_naive(end_local)

    return {
        "report_type": "monthly",
        "month": start_local.strftime("%Y-%m"),
        **generate_stock_report(
            db,
            start_utc,
            end_utc,
        ),
    }


# --------------------------------------------------
# View One Activity
# Admin + Manager + Staff
# --------------------------------------------------

@router.get(
    "/{activity_id}",
    response_model=StockActivityResponse,
)
def get_stock_activity(
    activity_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([
            UserRole.ADMIN,
            UserRole.MANAGER,
            UserRole.STAFF,
        ])
    ),
):
    activity = db.get(StockActivity, activity_id)

    if activity is None:
        raise HTTPException(
            status_code=404,
            detail="Stock activity not found.",
        )

    return activity


# --------------------------------------------------
# Update History: Disabled
# --------------------------------------------------

@router.put("/{activity_id}")
def update_stock_activity(
    activity_id: int,
    current_user: User = Depends(
        require_roles([UserRole.ADMIN])
    ),
):
    raise HTTPException(
        status_code=405,
        detail="Stock activity history cannot be updated. Use a new Stock Adjustment entry.",
    )


# --------------------------------------------------
# Delete History: Disabled
# --------------------------------------------------

@router.delete("/{activity_id}")
def delete_stock_activity(
    activity_id: int,
    current_user: User = Depends(
        require_roles([UserRole.ADMIN])
    ),
):
    raise HTTPException(
        status_code=405,
        detail="Stock activity history cannot be deleted.",
    )
