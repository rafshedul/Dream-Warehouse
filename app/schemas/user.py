from pydantic import BaseModel


class UserCreate(BaseModel):
    password: str
    role: str
    email: str
    contact_id: int