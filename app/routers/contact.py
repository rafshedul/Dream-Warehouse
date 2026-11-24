
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.contact import Contact
from app.models.user import User
from app.schemas.contact import ContactCreate, ContactResponse
from app.core.dependencies import require_roles
from app.core.roles import UserRole


router = APIRouter(
    prefix="/contacts",
    tags=["Contacts"],
)


# Create Contact: Admin + Manager + Staff
@router.post("/", response_model=ContactResponse, status_code=201)
def create_contact(
    data: ContactCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([
            UserRole.ADMIN,
            UserRole.MANAGER,
            UserRole.STAFF,
        ])
    ),
):
    contact = Contact(
        name=data.name,
        phone=data.phone,
        address=data.address,
    )

    db.add(contact)

    try:
        db.commit()
        db.refresh(contact)
        return contact
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Could not create contact.",
        )


# View All Contacts: Admin + Manager + Staff
@router.get("/", response_model=list[ContactResponse])
def get_contacts(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([
            UserRole.ADMIN,
            UserRole.MANAGER,
            UserRole.STAFF,
        ])
    ),
):
    return db.query(Contact).order_by(Contact.id).all()


# View One Contact: Admin + Manager + Staff
@router.get("/{contact_id}", response_model=ContactResponse)
def get_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([
            UserRole.ADMIN,
            UserRole.MANAGER,
            UserRole.STAFF,
        ])
    ),
):
    contact = db.get(Contact, contact_id)

    if contact is None:
        raise HTTPException(
            status_code=404,
            detail="Contact not found",
        )

    return contact


# Update Contact: Admin + Manager + Staff
@router.put("/{contact_id}", response_model=ContactResponse)
def update_contact(
    contact_id: int,
    data: ContactCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([
            UserRole.ADMIN,
            UserRole.MANAGER,
            UserRole.STAFF,
        ])
    ),
):
    contact = db.get(Contact, contact_id)

    if contact is None:
        raise HTTPException(
            status_code=404,
            detail="Contact not found",
        )

    contact.name = data.name
    contact.phone = data.phone
    contact.address = data.address

    db.commit()
    db.refresh(contact)

    return contact


# Delete Contact: Admin only
@router.delete("/{contact_id}", status_code=204)
def delete_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([UserRole.ADMIN])
    ),
):
    contact = db.get(Contact, contact_id)

    if contact is None:
        raise HTTPException(
            status_code=404,
            detail="Contact not found",
        )

    db.delete(contact)
    db.commit()

    return Response(status_code=204)
