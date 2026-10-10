from fastapi import APIRouter, Depends,HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.contact import Contact
from app.schemas.contact import ContactCreate

router = APIRouter(
    prefix="/contacts",
    tags=["Contacts"]
)


@router.post("/")
def create_contact(
    contact: ContactCreate,
    db: Session = Depends(get_db)
):
    new_contact = Contact(
        name=contact.name,
        phone=contact.phone,
        address=contact.address
    )

    db.add(new_contact)
    db.commit()
    db.refresh(new_contact)

    return new_contact
@router.get("/")
def get_contacts(db: Session = Depends(get_db)):
    contacts = db.query(Contact).all()

    return contacts

@router.get("/{contact_id}")
def get_contact(
    contact_id: int,
    db: Session = Depends(get_db)
):
    contact = db.query(Contact).filter(
        Contact.id == contact_id
    ).first()

    if not contact:
        raise HTTPException(
            status_code=404,
            detail="Contact not found"
        )

    return contact
@router.put("/{contact_id}")
def update_contact(
    contact_id: int,
    contact: ContactCreate,
    db: Session = Depends(get_db)
):
    existing_contact = db.query(Contact).filter(
        Contact.id == contact_id
    ).first()

    if not existing_contact:
        raise HTTPException(
            status_code=404,
            detail="Contact not found"
        )

    existing_contact.name = contact.name
    existing_contact.phone = contact.phone
    existing_contact.address = contact.address

    db.commit()
    db.refresh(existing_contact)

    return existing_contact
@router.delete("/{contact_id}")
def delete_contact(
    contact_id: int,
    db: Session = Depends(get_db)
):
    contact = db.query(Contact).filter(
        Contact.id == contact_id
    ).first()

    if not contact:
        raise HTTPException(
            status_code=404,
            detail="Contact not found"
        )

    db.delete(contact)
    db.commit()

    return {"message": "Contact deleted successfully"}