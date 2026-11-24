
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import CORS_ORIGINS
from app.models.user import User

# Routers
from app.routers.contact import router as contact_router
from app.routers.user import router as user_router
from app.routers.product import router as product_router
from app.routers.category import router as category_router
from app.routers.supplier import router as supplier_router
from app.routers.purchase import router as purchase_router
from app.routers.supplier_invoice import router as supplier_invoice_router
from app.routers.purchase_order_item import router as purchase_order_item_router
from app.routers.warehouse import router as warehouse_router
from app.routers.stock import router as stock_router
from app.routers.sales_order import router as sales_order_router
from app.routers.sales_order_item import router as sales_order_item_router
from app.routers.shipment import router as shipment_router
from app.routers.customer import router as customer_router
from app.routers.transaction import router as transaction_router
from app.routers.stock_activity import router as stock_activity_router
from app.routers.invoice import router as invoice_router
from app.routers.auth import router as auth_router
from app.routers.storefront import router as storefront_router
from app.routers.payment import router as payment_router

# Stock Adjustment Router
from app.routers.stock_adjustment_request import (
    router as stock_adjustment_request_router
)

# Role-based routers
from app.core.dependencies import get_current_user
from app.routers import admin, manager, staff


# Initialize FastAPI
app = FastAPI(
    title="ERP API",
    description="Inventory and Warehouse Management ERP",
    version="1.0.0",
)


# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Register Routers
app.include_router(contact_router)
app.include_router(user_router)
app.include_router(product_router)
app.include_router(category_router)
app.include_router(supplier_router)
app.include_router(purchase_router)
app.include_router(supplier_invoice_router)
app.include_router(purchase_order_item_router)
app.include_router(warehouse_router)
app.include_router(stock_router)
app.include_router(sales_order_router)
app.include_router(sales_order_item_router)
app.include_router(shipment_router)
app.include_router(customer_router)
app.include_router(transaction_router)
app.include_router(stock_activity_router)
app.include_router(invoice_router)
app.include_router(auth_router)
app.include_router(storefront_router)
app.include_router(payment_router)

# Stock Adjustment Requests
app.include_router(stock_adjustment_request_router)


# Role-based Routers
app.include_router(admin.router)
app.include_router(manager.router)
app.include_router(staff.router)


# Current User API
@app.get("/me")
def read_current_user(
    current_user: User = Depends(get_current_user)
):
    return {
        "user_id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
    }
