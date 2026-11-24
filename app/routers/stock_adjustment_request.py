
from datetime import datetime
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.core.dependencies import require_roles
from app.core.roles import UserRole

from app.models.user import User
from app.models.product import Product
from app.models.warehouse import Warehouse
from app.models.stock import Stock
from app.models.stock_activity import StockActivity
from app.models.stock_adjustment_request import StockAdjustmentRequest

from app.schemas.stock_adjustment_request import (
    StockAdjustmentRequestCreate,
    StockAdjustmentReview,
    StockAdjustmentRequestResponse,
    StockAdjustmentRequestListResponse,
)


router = APIRouter(
    prefix="/stock-adjustment-requests",
    tags=["Stock Adjustment Requests"],
)


# --------------------------------------------------
# Create Adjustment Request
# Staff only
# --------------------------------------------------

@router.post(
    "/",
    response_model=StockAdjustmentRequestResponse,
    status_code=201,
)
def create_adjustment_request(
    data: StockAdjustmentRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([UserRole.STAFF])
    ),
):
    if not data.reason.strip():
        raise HTTPException(
            status_code=422,
            detail="Reason cannot be empty.",
        )

    product = db.get(Product, data.product_id)

    if product is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found.",
        )

    warehouse = db.get(Warehouse, data.warehouse_id)

    if warehouse is None:
        raise HTTPException(
            status_code=404,
            detail="Warehouse not found.",
        )

    try:
        stock = (
            db.query(Stock)
            .filter(
                Stock.product_id == data.product_id,
                Stock.warehouse_id == data.warehouse_id,
            )
            .with_for_update()
            .first()
        )

        current_quantity = stock.quantity if stock else 0

        difference = data.counted_quantity - current_quantity

        if difference == 0:
            raise HTTPException(
                status_code=400,
                detail="No stock adjustment required. Quantities are equal.",
            )

        adjustment = StockAdjustmentRequest(
            product_id=data.product_id,
            warehouse_id=data.warehouse_id,
            current_quantity=current_quantity,
            counted_quantity=data.counted_quantity,
            difference=difference,
            reason=data.reason.strip(),
            status="pending",
            requested_by=current_user.id,
        )

        db.add(adjustment)
        db.commit()
        db.refresh(adjustment)

        return adjustment

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="Unable to create adjustment request because of a database conflict.",
        )

    except Exception:
        db.rollback()
        raise


# --------------------------------------------------
# View Adjustment Requests
# Admin + Manager + Staff
# Staff can view own requests only
# --------------------------------------------------

@router.get(
    "/",
    response_model=StockAdjustmentRequestListResponse,
)
def get_adjustment_requests(
    status_filter: str | None = Query(
        default=None,
        alias="status",
        pattern="^(pending|approved|rejected)$",
    ),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([
            UserRole.ADMIN,
            UserRole.MANAGER,
            UserRole.STAFF,
        ])
    ),
):
    query = db.query(StockAdjustmentRequest)

    if current_user.role == UserRole.STAFF.value:
        query = query.filter(
            StockAdjustmentRequest.requested_by == current_user.id
        )

    if status_filter is not None:
        query = query.filter(
            StockAdjustmentRequest.status == status_filter
        )

    total_requests = query.count()

    total_pages = (
        ceil(total_requests / limit)
        if total_requests
        else 0
    )

    requests = (
        query
        .order_by(
            StockAdjustmentRequest.created_at.desc(),
            StockAdjustmentRequest.id.desc(),
        )
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return {
        "total_requests": total_requests,
        "total_pages": total_pages,
        "current_page": page,
        "limit": limit,
        "requests": requests,
    }


# --------------------------------------------------
# Approve Adjustment Request
# Admin only
# --------------------------------------------------

@router.post(
    "/{request_id}/approve",
    response_model=StockAdjustmentRequestResponse,
)
def approve_adjustment_request(
    request_id: int,
    data: StockAdjustmentReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([UserRole.ADMIN])
    ),
):
    try:
        # Lock adjustment request
        adjustment = (
            db.query(StockAdjustmentRequest)
            .filter(
                StockAdjustmentRequest.id == request_id
            )
            .with_for_update()
            .first()
        )

        if adjustment is None:
            raise HTTPException(
                status_code=404,
                detail="Adjustment request not found.",
            )

        if adjustment.status != "pending":
            raise HTTPException(
                status_code=409,
                detail="Only pending requests can be approved.",
            )

        # Lock current stock
        stock = (
            db.query(Stock)
            .filter(
                Stock.product_id == adjustment.product_id,
                Stock.warehouse_id == adjustment.warehouse_id,
            )
            .with_for_update()
            .first()
        )

        actual_current_quantity = (
            stock.quantity if stock else 0
        )

        # Prevent stale adjustment approval
        if actual_current_quantity != adjustment.current_quantity:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": (
                        "Stock changed after this request was created. "
                        "Please create a new adjustment request."
                    ),
                    "requested_current_quantity": adjustment.current_quantity,
                    "actual_current_quantity": actual_current_quantity,
                },
            )

        # Update stock
        if stock is None:
            stock = Stock(
                product_id=adjustment.product_id,
                warehouse_id=adjustment.warehouse_id,
                quantity=adjustment.counted_quantity,
            )
            db.add(stock)
        else:
            stock.quantity = adjustment.counted_quantity

        # Create immutable activity history.
        # Positive = stock increased.
        # Negative = stock decreased.
        activity = StockActivity(
            product_id=adjustment.product_id,
            warehouse_id=adjustment.warehouse_id,
            quantity=adjustment.difference,
            movement_type="ADJUSTMENT",
            date=datetime.utcnow(),
            created_by=current_user.id,
        )

        db.add(activity)

        # Update request review information
        adjustment.status = "approved"
        adjustment.reviewed_by = current_user.id
        adjustment.review_note = data.review_note
        adjustment.reviewed_at = datetime.utcnow()

        # Save stock + activity + request together
        db.commit()
        db.refresh(adjustment)

        return adjustment

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                "Database conflict while approving adjustment. "
                "Please verify stock and try again."
            ),
        )

    except Exception:
        db.rollback()
        raise


# --------------------------------------------------
# Reject Adjustment Request
# Admin only
# --------------------------------------------------

@router.post(
    "/{request_id}/reject",
    response_model=StockAdjustmentRequestResponse,
)
def reject_adjustment_request(
    request_id: int,
    data: StockAdjustmentReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([UserRole.ADMIN])
    ),
):
    try:
        adjustment = (
            db.query(StockAdjustmentRequest)
            .filter(
                StockAdjustmentRequest.id == request_id
            )
            .with_for_update()
            .first()
        )

        if adjustment is None:
            raise HTTPException(
                status_code=404,
                detail="Adjustment request not found.",
            )

        if adjustment.status != "pending":
            raise HTTPException(
                status_code=409,
                detail="Only pending requests can be rejected.",
            )

        adjustment.status = "rejected"
        adjustment.reviewed_by = current_user.id
        adjustment.review_note = data.review_note
        adjustment.reviewed_at = datetime.utcnow()

        db.commit()
        db.refresh(adjustment)

        return adjustment

    except Exception:
        db.rollback()
        raise
