from pydantic import BaseModel


class ContactCreate(BaseModel):
    name: str
    phone: str
    address: str


class ContactResponse(BaseModel):
    id: int
    name: str
    phone: str
    address: str

    class Config:
        from_attributes = True