
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class CustomerCreate(BaseModel):
    contact_id: int | None = Field(default=None, gt=0)
    company_name: str = Field(min_length=1, max_length=150)
    address: str = Field(min_length=1, max_length=255)
    contact_name: str | None = Field(default=None, min_length=1, max_length=150)
    contact_phone: str | None = Field(default=None, min_length=1, max_length=50)
    contact_address: str | None = Field(default=None, min_length=1, max_length=255)

    @model_validator(mode="after")
    def validate_contact_reference(self):
        contact_details = (self.contact_name, self.contact_phone, self.contact_address)
        if self.contact_id is not None and any(value is not None for value in contact_details):
            raise ValueError("Provide either contact_id or all new contact details, not both.")
        if self.contact_id is None and any(value is None for value in contact_details):
            raise ValueError("Provide an existing contact_id or complete new contact details.")
        return self


class CustomerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    contact_id: int
    created_by: int | None = None
    company_name: str
    address: str
    created_at: datetime
