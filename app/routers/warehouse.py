
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.warehouse import Warehouse
from app.schemas.warehouse import WarehouseCreate, WarehouseResponse
from app.core.dependencies import require_roles
from app.core.roles import UserRole


router = APIRouter(
    prefix="/warehouses",
    tags=["Warehouses"],
)


# Create Warehouse: Admin only
@router.post("/", response_model=WarehouseResponse, status_code=201)
def create_warehouse(
    data: WarehouseCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles([UserRole.ADMIN])),
):
    warehouse = Warehouse(**data.model_dump())
    db.add(warehouse)

    try:
        db.commit()
        db.refresh(warehouse)
        return warehouse
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Warehouse name already exists or database constraint violation",
        )


# Get All Warehouses: Admin + Manager + Staff
@router.get("/", response_model=list[WarehouseResponse])
def get_warehouses(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([
            UserRole.ADMIN,
            UserRole.MANAGER,
            UserRole.STAFF
        ])
    ),
):
    return db.query(Warehouse).order_by(Warehouse.id).all()


# Get One Warehouse: Admin + Manager + Staff
@router.get("/{warehouse_id}", response_model=WarehouseResponse)
def get_warehouse(
    warehouse_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([
            UserRole.ADMIN,
            UserRole.MANAGER,
            UserRole.STAFF
        ])
    ),
):
    warehouse = db.get(Warehouse, warehouse_id)

    if warehouse is None:
        raise HTTPException(
            status_code=404,
            detail="Warehouse not found",
        )

    return warehouse


# Update Warehouse: Admin + Manager
@router.put("/{warehouse_id}", response_model=WarehouseResponse)
def update_warehouse(
    warehouse_id: int,
    data: WarehouseCreate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([
            UserRole.ADMIN,
            UserRole.MANAGER
        ])
    ),
):
    warehouse = db.get(Warehouse, warehouse_id)

    if warehouse is None:
        raise HTTPException(
            status_code=404,
            detail="Warehouse not found",
        )

    for field, value in data.model_dump().items():
        setattr(warehouse, field, value)

    try:
        db.commit()
        db.refresh(warehouse)
        return warehouse
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Warehouse name already exists or database constraint violation",
        )


# Delete Warehouse: Admin only
@router.delete("/{warehouse_id}", status_code=204)
def delete_warehouse(
    warehouse_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles([UserRole.ADMIN])),
):
    warehouse = db.get(Warehouse, warehouse_id)

    if warehouse is None:
        raise HTTPException(
            status_code=404,
            detail="Warehouse not found",
        )

    db.delete(warehouse)
    db.commit()

    return Response(status_code=204)
