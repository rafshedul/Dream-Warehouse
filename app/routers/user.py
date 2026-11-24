
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models.contact import Contact
from app.models.user import User
from app.schemas.user import (
    AdminUserCreate,
    UserCreate,
    UserRoleUpdate,
    UserStatusUpdate,
)
from app.core.roles import UserRole
from app.core.dependencies import require_roles
from app.core.security import hash_password


router = APIRouter(
    prefix="/users",
    tags=["Users"]
)


def admin_only():
    return Depends(require_roles([UserRole.ADMIN]))


# Create a user with an explicit role. This endpoint is admin-only.
@router.post("/", status_code=status.HTTP_201_CREATED)
def create_user(
    user: AdminUserCreate,
    db: Session = Depends(get_db),
    current_user: User = admin_only()
):
    try:
        contact = Contact(name=user.name, phone=user.phone, address=user.address)
        db.add(contact)
        db.flush()
        new_user = User(
            password=hash_password(user.password),
            role=user.role.value,
            email=user.email,
            contact_id=contact.id,
            is_active=True,
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not create user. This email may already be registered."
        )

    return {
        "id": new_user.id,
        "email": new_user.email,
        "role": new_user.role,
        "is_active": new_user.is_active,
        "contact_id": new_user.contact_id,
        "name": contact.name,
        "phone": contact.phone,
        "address": contact.address,
        "created_at": new_user.created_at,
    }


@router.patch("/{user_id}/role")
def update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = admin_only(),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.id == current_user.id and payload.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot change your own admin role.",
        )

    user.role = payload.role.value
    db.commit()
    db.refresh(user)
    return {"id": user.id, "email": user.email, "role": user.role, "is_active": user.is_active}


@router.patch("/{user_id}/status")
def update_user_status(
    user_id: int,
    payload: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = admin_only(),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.id == current_user.id and not payload.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own admin account.",
        )

    user.is_active = payload.is_active
    db.commit()
    db.refresh(user)
    return {"id": user.id, "email": user.email, "role": user.role, "is_active": user.is_active}


# Get all users: Admin only
@router.get("/")
def get_users(
    db: Session = Depends(get_db),
    current_user: User = admin_only()
):
    users = db.query(User).order_by(User.created_at.desc(), User.id.desc()).all()

    return [
        {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active,
            "contact_id": user.contact_id,
            "name": user.contact.name if user.contact else None,
            "phone": user.contact.phone if user.contact else None,
            "address": user.contact.address if user.contact else None,
            "created_at": user.created_at,
        }
        for user in users
    ]


# Get one user: Admin only
@router.get("/{user_id}")
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = admin_only()
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "contact_id": user.contact_id,
        "name": user.contact.name if user.contact else None,
    }


# Update user details and role: Admin only
@router.put("/{user_id}")
def update_user(
    user_id: int,
    user: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = admin_only()
):
    existing_user = db.query(User).filter(User.id == user_id).first()

    if not existing_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    existing_user.password = hash_password(user.password)
    existing_user.email = user.email
    existing_user.contact_id = user.contact_id
    existing_user.role = user.role.value

    try:
        db.commit()
        db.refresh(existing_user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not update user. Email or contact may already exist."
        )

    return {
        "id": existing_user.id,
        "email": existing_user.email,
        "role": existing_user.role,
        "is_active": existing_user.is_active,
        "contact_id": existing_user.contact_id
    }


# Delete user: Admin only
@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = admin_only()
):
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin cannot delete their own account"
        )

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    db.delete(user)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User cannot be deleted because related records exist."
        )

    return {"message": "User deleted successfully"}
