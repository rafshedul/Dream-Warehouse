
from typing import List

from fastapi import Depends, HTTPException, status, Cookie
from sqlalchemy.orm import Session

from app.core.roles import UserRole
from app.database import get_db
from app.models.user import User
from app.core.security import decode_access_token


def get_current_user(
    access_token: str | None = Cookie(default=None, include_in_schema=False),
    db: Session = Depends(get_db),
) -> User:

    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    try:
        payload = decode_access_token(access_token)
        user_id = payload.get("sub")

        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )

        user = db.query(User).filter(
            User.id == int(user_id)
        ).first()

        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive",
            )

        return user

    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
        )


def get_optional_current_user(
    access_token: str | None = Cookie(default=None, include_in_schema=False),
    db: Session = Depends(get_db),
) -> User | None:
    """Resolve a session when present while allowing anonymous public reads."""
    if access_token is None:
        return None
    return get_current_user(access_token=access_token, db=db)


def require_roles(allowed_roles: List[UserRole]):
    def role_checker(
        current_user: User = Depends(get_current_user),
    ):
        if current_user.role not in [
            role.value for role in allowed_roles
        ]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource",
            )

        return current_user

    return role_checker
