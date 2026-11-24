
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db

from app.models.category import Category
from app.models.product import Product
from app.models.user import User

from app.schemas.category import CategoryCreate, CategoryResponse
from app.schemas.product import ProductResponse

from app.core.dependencies import require_roles
from app.core.roles import UserRole


router = APIRouter(
    prefix="/categories",
    tags=["Categories"]
)


# Public: Everyone can view all categories
@router.get("/", response_model=list[CategoryResponse])
def get_categories(
    db: Session = Depends(get_db)
):
    return db.query(Category).all()


# Only Admin and Manager can create a category
@router.post("/", response_model=CategoryResponse, status_code=201)
def create_category(
    category_data: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([
            UserRole.ADMIN,
            UserRole.MANAGER
        ])
    )
):
    category = Category(**category_data.model_dump())

    try:
        db.add(category)
        db.commit()
        db.refresh(category)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Category name already exists"
        )

    return category


# Public: Get all products belonging to a category
@router.get(
    "/{category_id}/products/",
    response_model=list[ProductResponse]
)
def get_category_products(
    category_id: int,
    db: Session = Depends(get_db)
):
    # Check whether category exists
    category = db.query(Category).filter(
        Category.id == category_id
    ).first()

    if category is None:
        raise HTTPException(
            status_code=404,
            detail="Category not found"
        )

    # Get products belonging to this category
    products = db.query(Product).filter(
        Product.category_id == category_id
    ).all()

    return products


# Public: Everyone can view one category
@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(
    category_id: int,
    db: Session = Depends(get_db)
):
    category = db.query(Category).filter(
        Category.id == category_id
    ).first()

    if category is None:
        raise HTTPException(
            status_code=404,
            detail="Category not found"
        )

    return category


# Only Admin and Manager can update a category
@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    category_data: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([
            UserRole.ADMIN,
            UserRole.MANAGER
        ])
    )
):
    category = db.query(Category).filter(
        Category.id == category_id
    ).first()

    if category is None:
        raise HTTPException(
            status_code=404,
            detail="Category not found"
        )

    for field, value in category_data.model_dump().items():
        setattr(category, field, value)

    try:
        db.commit()
        db.refresh(category)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Category name already exists"
        )

    return category


# Only Admin can delete a category
@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([
            UserRole.ADMIN
        ])
    )
):
    category = db.query(Category).filter(
        Category.id == category_id
    ).first()

    if category is None:
        raise HTTPException(
            status_code=404,
            detail="Category not found"
        )

    try:
        db.delete(category)
        db.commit()

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Cannot delete category because products are linked to it"
        )

    return {
        "message": "Category deleted successfully"
    }
