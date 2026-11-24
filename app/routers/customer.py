
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.contact import Contact
from app.models.customer import Customer
from app.models.user import User
from app.schemas.customer import CustomerCreate, CustomerResponse
from app.core.dependencies import require_roles
from app.core.roles import UserRole


router = APIRouter(
    prefix="/customers",
    tags=["Customers"],
)


# Create Customer: Admin + Manager + Staff
@router.post("/", response_model=CustomerResponse, status_code=201)
def create_customer(
    data: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([
            UserRole.ADMIN,
            UserRole.MANAGER,
            UserRole.STAFF,
        ])
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

        customer = Customer(
            contact_id=contact_id,
            company_name=data.company_name,
            address=data.address,
            created_by=current_user.id,
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)
        return customer
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Invalid contact_id.",
        )


# View All Customers: Admin + Manager + Staff
@router.get("/", response_model=list[CustomerResponse])
def get_customers(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([
            UserRole.ADMIN,
            UserRole.MANAGER,
            UserRole.STAFF,
        ])
    ),
):
    return db.query(Customer).order_by(Customer.id).all()


# View One Customer: Admin + Manager + Staff
@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([
            UserRole.ADMIN,
            UserRole.MANAGER,
            UserRole.STAFF,
        ])
    ),
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()

    if customer is None:
        raise HTTPException(
            status_code=404,
            detail="Customer not found.",
        )

    return customer


# Update Customer: Admin + Manager + Staff
@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: int,
    data: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([
            UserRole.ADMIN,
            UserRole.MANAGER,
            UserRole.STAFF,
        ])
    ),
):
    customer = db.get(Customer, customer_id)

    if customer is None:
        raise HTTPException(
            status_code=404,
            detail="Customer not found.",
        )

    # Staff can update only their own Customers
    if (
        current_user.role == UserRole.STAFF.value
        and customer.created_by != current_user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="You can only update your own Customers.",
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

        customer.contact_id = contact_id
        customer.company_name = data.company_name
        customer.address = data.address
        db.commit()
        db.refresh(customer)
        return customer
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Invalid contact_id.",
        )


# Delete Customer: Admin only
@router.delete("/{customer_id}", status_code=204)
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([UserRole.ADMIN])
    ),
):
    customer = db.get(Customer, customer_id)

    if customer is None:
        raise HTTPException(
            status_code=404,
            detail="Customer not found.",
        )

    db.delete(customer)
    db.commit()

    return Response(status_code=204)
