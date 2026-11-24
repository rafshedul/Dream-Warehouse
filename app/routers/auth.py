from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models.contact import Contact
from app.models.user import User
from app.schemas.user import UserRegister, UserLogin, UserProfileUpdate
from app.core.roles import UserRole
from app.core.dependencies import get_current_user
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
)
from app.core.config import COOKIE_SECURE

router = APIRouter(tags=["Authentication"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(
    user_data: UserRegister,
    db: Session = Depends(get_db),
):
    existing_user = db.query(User).filter(
        User.email == user_data.email
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    try:
        contact = Contact(
            name=user_data.name,
            phone=user_data.phone,
            address=user_data.address,
        )

        db.add(contact)
        db.flush()

        user = User(
            email=user_data.email,
            password=hash_password(user_data.password),
            role=UserRole.USER.value,
            contact_id=contact.id,
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        return {
            "message": "Registration successful",
            "user_id": user.id,
            "email": user.email,
            "role": user.role,
            "contact_id": user.contact_id,
        }

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Registration failed because of conflicting data",
        )


@router.post("/login")
def login(
    user_data: UserLogin,
    response: Response,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(
        User.email == user_data.email
    ).first()

    if not user or not verify_password(
        user_data.password,
        user.password,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    access_token = create_access_token(
        data={"sub": str(user.id)}
    )

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=30 * 60,
        path="/",
    )

    return {
        "message": "Login successful",
        "user_id": user.id,
        "email": user.email,
        "role": user.role,
    }


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(
        key="access_token",
        path="/",
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
    )

    return {"message": "Logout successful"}



@router.get("/auth/me", tags=["Authentication"])
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    contact = db.query(Contact).filter(
        Contact.id == current_user.contact_id
    ).first()

    return {
        "user_id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "profile": {
            "name": contact.name if contact else None,
            "phone": contact.phone if contact else None,
            "address": contact.address if contact else None,
        },
    }


@router.patch("/auth/profile", tags=["Authentication"])
def update_my_profile(
    profile_data: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing_email = db.query(User).filter(
        User.email == profile_data.email,
        User.id != current_user.id,
    ).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email is already registered.",
        )

    contact = db.query(Contact).filter(
        Contact.id == current_user.contact_id
    ).first()
    if contact is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile contact details were not found.",
        )

    current_user.email = profile_data.email
    contact.name = profile_data.name
    contact.phone = profile_data.phone
    contact.address = profile_data.address

    try:
        db.commit()
        db.refresh(current_user)
        db.refresh(contact)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Profile update failed because the email is already in use.",
        )

    return {
        "user_id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "profile": {
            "name": contact.name,
            "phone": contact.phone,
            "address": contact.address,
        },
    }
