
from decimal import Decimal
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, asc, desc
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db

from app.models.product import Product
from app.models.category import Category
from app.models.user import User
from app.models.stock import Stock
from app.models.warehouse import Warehouse

from app.schemas.product import (
    ProductCreate,
    ProductResponse,
    ProductDetailResponse,
    ProductPaginationResponse,
)

from app.core.dependencies import get_optional_current_user, require_roles
from app.core.roles import UserRole


router = APIRouter(
    prefix="/products",
    tags=["Products"]
)


# =====================================================
# GET: Search + Filter + Sorting + Pagination
# Public Access
# =====================================================

@router.get("/", response_model=ProductPaginationResponse)
def get_products(
    search: str | None = Query(default=None, min_length=1),
    category_id: int | None = Query(default=None, gt=0),

    min_price: Decimal | None = Query(default=None, ge=0),
    max_price: Decimal | None = Query(default=None, ge=0),

    sort_by: str = Query(
        default="created_at",
        pattern="^(price|name|created_at)$"
    ),

    sort_order: str = Query(
        default="desc",
        pattern="^(asc|desc)$"
    ),

    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),

    db: Session = Depends(get_db)
):

    if (
        min_price is not None
        and max_price is not None
        and min_price > max_price
    ):
        raise HTTPException(
            status_code=400,
            detail="min_price cannot be greater than max_price"
        )

    query = (
        db.query(Product)
        .join(Category, Product.category_id == Category.id)
    )

    if search:
        search_term = f"%{search.strip()}%"

        query = query.filter(
            or_(
                Product.name.ilike(search_term),
                Category.name.ilike(search_term)
            )
        )

    if category_id is not None:
        query = query.filter(
            Product.category_id == category_id
        )

    if min_price is not None:
        query = query.filter(
            Product.unit_price >= min_price
        )

    if max_price is not None:
        query = query.filter(
            Product.unit_price <= max_price
        )

    total_products = query.count()

    total_pages = (
        ceil(total_products / limit)
        if total_products > 0
        else 0
    )

    if page > max(total_pages, 1):
        raise HTTPException(
            status_code=404,
            detail={
                "message": "Requested page does not exist",
                "requested_page": page,
                "total_pages": total_pages
            }
        )

    sort_columns = {
        "price": Product.unit_price,
        "name": Product.name,
        "created_at": Product.created_at
    }

    sort_column = sort_columns[sort_by]

    if sort_order == "asc":
        query = query.order_by(
            asc(sort_column),
            asc(Product.id)
        )
    else:
        query = query.order_by(
            desc(sort_column),
            desc(Product.id)
        )

    offset = (page - 1) * limit

    products = (
        query
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "total_products": total_products,
        "total_pages": total_pages,
        "current_page": page,
        "limit": limit,
        "products": products
    }


# =====================================================
# POST: Create Product
# Admin and Manager
# =====================================================

@router.post("/", response_model=ProductResponse, status_code=201)
def create_product(
    product_data: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([
            UserRole.ADMIN,
            UserRole.MANAGER
        ])
    )
):

    product = Product(
        **product_data.model_dump(),
        created_by=current_user.id
    )

    try:
        db.add(product)
        db.commit()
        db.refresh(product)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="SKU already exists or category_id is invalid"
        )

    return product


# =====================================================
# GET: Single Product with Stock Details
# Public Access
# =====================================================

@router.get(
    "/{product_id}",
    response_model=ProductDetailResponse | ProductResponse
)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):

    product = (
        db.query(Product)
        .filter(Product.id == product_id)
        .first()
    )

    if product is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    # Public users can read the product catalog, but warehouse quantities are
    # operational inventory data and are only returned to team accounts.
    if current_user is None or current_user.role == UserRole.USER.value:
        return product

    # Get all warehouse stocks for this product
    stocks = (
        db.query(Stock, Warehouse.name)
        .join(
            Warehouse,
            Stock.warehouse_id == Warehouse.id
        )
        .filter(Stock.product_id == product_id)
        .all()
    )

    total_stock = sum(
        stock.quantity for stock, warehouse_name in stocks
    )

    # Determine stock status
    if total_stock == 0:
        stock_status = "OUT_OF_STOCK"

    elif total_stock <= product.reorder_level:
        stock_status = "LOW_STOCK"

    else:
        stock_status = "IN_STOCK"

    # Warehouse-wise stock
    warehouse_stocks = [
        {
            "warehouse_id": stock.warehouse_id,
            "warehouse_name": warehouse_name,
            "quantity": stock.quantity
        }
        for stock, warehouse_name in stocks
    ]

    return {
        "id": product.id,
        "category_id": product.category_id,
        "created_by": product.created_by,
        "sku": product.sku,
        "name": product.name,
        "description": product.description,
        "unit_price": product.unit_price,
        "reorder_level": product.reorder_level,
        "created_at": product.created_at,
        "updated_at": product.updated_at,
        "total_stock": total_stock,
        "stock_status": stock_status,
        "warehouse_stocks": warehouse_stocks
    }


# =====================================================
# PUT: Update Product
# Admin and Manager
# =====================================================

@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    product_data: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([
            UserRole.ADMIN,
            UserRole.MANAGER
        ])
    )
):

    product = (
        db.query(Product)
        .filter(Product.id == product_id)
        .first()
    )

    if product is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    update_data = product_data.model_dump()

    for field, value in update_data.items():
        setattr(product, field, value)

    try:
        db.commit()
        db.refresh(product)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="SKU already exists or category_id is invalid"
        )

    return product


# =====================================================
# DELETE: Product
# Admin Only
# =====================================================

@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([
            UserRole.ADMIN
        ])
    )
):

    product = (
        db.query(Product)
        .filter(Product.id == product_id)
        .first()
    )

    if product is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    db.delete(product)

    try:
        db.commit()

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="Product cannot be deleted because related records exist."
        )

    return {
        "message": "Product deleted successfully"
    }
