from fastapi import APIRouter, Depends,HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)
@router.post("/")
def create_user(
    user: UserCreate,
    db: Session = Depends(get_db)
):
    new_user = User(
        password=user.password,
        role=user.role,
        email=user.email,
        contact_id=user.contact_id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user
@router.get("/")
def get_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return users
@router.get("/{user_id}")
def get_user(
    user_id: int,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.id == user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )
    return user
@router.put("/{user_id}")
def update_user(
    user_id: int,
    user: UserCreate,
    db: Session = Depends(get_db)
):
    existing_user = db.query(User).filter(
        User.id == user_id
    ).first()

    if not existing_user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )
    existing_user.password = user.password
    existing_user.role = user.role
    existing_user.email = user.email
    existing_user.contact_id = user.contact_id
    db.commit()
    db.refresh(existing_user)
    return existing_user
@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.id == user_id
    ).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )
    db.delete(user)
    db.commit()

    return {"message": "User deleted successfully"}