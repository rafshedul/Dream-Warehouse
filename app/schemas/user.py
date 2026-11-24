
from pydantic import BaseModel, EmailStr, Field, field_validator
from app.core.roles import UserRole


# Public registration schema
class UserRegister(BaseModel):
    name: str
    phone: str
    address: str
    email: EmailStr
    password: str


# Internal/admin-created user schema
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    contact_id: int
    role: UserRole = UserRole.USER


class AdminUserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    phone: str = Field(min_length=1, max_length=50)
    address: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8)
    role: UserRole = UserRole.USER


class UserRoleUpdate(BaseModel):
    role: UserRole


class UserStatusUpdate(BaseModel):
    is_active: bool


class UserProfileUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    phone: str = Field(min_length=1, max_length=50)
    address: str = Field(min_length=1, max_length=255)
    email: EmailStr

    @field_validator("name", "phone", "address", mode="before")
    @classmethod
    def strip_profile_values(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


# Login schema
class UserLogin(BaseModel):
    email: EmailStr
    password: str
