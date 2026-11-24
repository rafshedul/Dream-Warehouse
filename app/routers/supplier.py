
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.contact import Contact
from app.models.supplier import Supplier
from app.schemas.supplier import SupplierCreate, SupplierResponse
from app.core.dependencies import require_roles
from app.core.roles import UserRole


router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


# Create Supplier: Admin + Manager
@router.post(
    "/",
    response_model=SupplierResponse,
    status_code=201,
)
def create_supplier(
    data: SupplierCreate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([UserRole.ADMIN, UserRole.MANAGER])
    ),
):
    try:
        contact_id = data.contact_id
        if contact_id is None:
            contact = Contact(
                name=data.contact_name,
                phone=data.contact_phone,
                address=data.contact_address,
            )
            db.add(contact)
            db.flush()
            contact_id = contact.id

        supplier = Supplier(
            contact_id=contact_id,
            company_name=data.company_name,
            address=data.address,
        )
        db.add(supplier)
        db.commit()
        db.refresh(supplier)
        return supplier
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Invalid contact_id or database constraint violation",
        )


# Get All Suppliers: Admin + Manager
@router.get("/", response_model=list[SupplierResponse])
def get_suppliers(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([UserRole.ADMIN, UserRole.MANAGER])
    ),
):
    return db.query(Supplier).order_by(Supplier.id).all()


# Get One Supplier: Admin + Manager
@router.get("/{supplier_id}", response_model=SupplierResponse)
def get_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([UserRole.ADMIN, UserRole.MANAGER])
    ),
):
    supplier = db.get(Supplier, supplier_id)

    if supplier is None:
        raise HTTPException(
            status_code=404,
            detail="Supplier not found",
        )

    return supplier


# Update Supplier: Admin + Manager
@router.put("/{supplier_id}", response_model=SupplierResponse)
def update_supplier(
    supplier_id: int,
    data: SupplierCreate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([UserRole.ADMIN, UserRole.MANAGER])
    ),
):
    supplier = db.get(Supplier, supplier_id)

    if supplier is None:
        raise HTTPException(
            status_code=404,
            detail="Supplier not found",
        )

    try:
        contact_id = data.contact_id
        if contact_id is None:
            contact = Contact(
                name=data.contact_name,
                phone=data.contact_phone,
                address=data.contact_address,
            )
            db.add(contact)
            db.flush()
            contact_id = contact.id

        supplier.contact_id = contact_id
        supplier.company_name = data.company_name
        supplier.address = data.address
        db.commit()
        db.refresh(supplier)
        return supplier
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Invalid contact_id or database constraint violation",
        )


# Delete Supplier: Admin only
@router.delete("/{supplier_id}", status_code=204)
def delete_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([UserRole.ADMIN])
    ),
):
    supplier = db.get(Supplier, supplier_id)

    if supplier is None:
        raise HTTPException(
            status_code=404,
            detail="Supplier not found",
        )

    db.delete(supplier)
    db.commit()

    return Response(status_code=204)
