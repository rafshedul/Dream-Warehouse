from fastapi import FastAPI

from app.database import Base, engine
from app.models.contact import Contact
from app.models.user import User

from app.routers.contact import router as contact_router
from app.routers.user import router as user_router


app = FastAPI()

Base.metadata.create_all(bind=engine)

app.include_router(contact_router)
app.include_router(user_router)