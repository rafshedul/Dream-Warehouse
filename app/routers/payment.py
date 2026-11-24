from decimal import Decimal, InvalidOperation
import logging

import httpx
from fastapi import APIRouter, Depends, Form, HTTPException
from fastapi.responses import RedirectResponse, PlainTextResponse
from sqlalchemy.orm import Session

from app.core.payment import (
    FRONTEND_BASE_URL, SSLCOMMERZ_BASE_URL, SSLCOMMERZ_STORE_ID,
    SSLCOMMERZ_STORE_PASSWORD,
)
from app.database import get_db
from app.models.invoice import Invoice
from app.models.sales_order import SalesOrder
from app.models.transaction import Transaction
from app.services.invoice_email import email_paid_order_invoice
from app.services.order_inventory import release_order_stock, reserve_order_stock

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/payments/sslcommerz", tags=["Payments"])


async def _validate_payment(tran_id: str, val_id: str) -> dict:
    if not SSLCOMMERZ_STORE_ID or not SSLCOMMERZ_STORE_PASSWORD:
        raise HTTPException(503, "SSLCommerz is not configured.")
    async with httpx.AsyncClient(timeout=25) as client:
        response = await client.get(
            f"{SSLCOMMERZ_BASE_URL}/validator/api/validationserverAPI.php",
            params={
                "val_id": val_id,
                "store_id": SSLCOMMERZ_STORE_ID,
                "store_passwd": SSLCOMMERZ_STORE_PASSWORD,
                "format": "json",
            },
        )
        response.raise_for_status()
        result = response.json()
    if result.get("status") not in {"VALID", "VALIDATED"}:
        raise HTTPException(400, "SSLCommerz could not validate this payment.")
    if result.get("tran_id") != tran_id:
        raise HTTPException(400, "SSLCommerz transaction ID does not match.")
    if result.get("currency", "").upper() != "BDT":
        raise HTTPException(400, "Payment currency does not match BDT.")
    return result


async def _complete(tran_id: str, val_id: str, db: Session) -> SalesOrder:
    result = await _validate_payment(tran_id, val_id)
    transaction = db.query(Transaction).filter(
        Transaction.gateway_tran_id == tran_id
    ).with_for_update().first()
    if transaction is None:
        raise HTTPException(404, "Payment transaction not found.")
    try:
        paid_amount = Decimal(str(result.get("amount", "0"))).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        raise HTTPException(400, "SSLCommerz returned an invalid payment amount.")
    expected = Decimal(transaction.amount).quantize(Decimal("0.01"))
    if paid_amount != expected:
        raise HTTPException(400, "Payment amount does not match the order total.")
    order = db.query(SalesOrder).filter(SalesOrder.id == transaction.sales_order_id).with_for_update().first()
    if order is None or order.customer_user_id is None:
        raise HTTPException(404, "Customer order not found.")
    if transaction.status not in {"paid", "completed"}:
        transaction.status = "paid"
        transaction.validation_id = str(result.get("val_id", val_id))[:80]
        order.payment_status = "paid"
        if order.stock_released:
            # The order was cancelled/expired before the payment arrived: take the stock back.
            if reserve_order_stock(db, order, order.created_by):
                order.order_status = "processing"
            else:
                order.order_status = "refund_required"
                logger.error(
                    "Payment received for order %s but stock is no longer available; refund required.",
                    order.id,
                )
        else:
            order.order_status = "processing"
        invoice = db.query(Invoice).filter(Invoice.sales_order_id == order.id).first()
        if invoice is None:
            invoice = Invoice(
                user_id=order.customer_user_id,
                sales_order_id=order.id,
                transaction_id=transaction.id,
            )
            db.add(invoice)
            db.flush()
        db.commit()
        try:
            email_paid_order_invoice(db, order, invoice)
        except Exception:
            logger.exception("Invoice email failed for online order %s", order.id)
    return order


async def _fail(tran_id: str, status: str, db: Session) -> SalesOrder | None:
    transaction = db.query(Transaction).filter(
        Transaction.gateway_tran_id == tran_id
    ).with_for_update().first()
    if transaction is None:
        return None
    order = db.query(SalesOrder).filter(SalesOrder.id == transaction.sales_order_id).with_for_update().first()
    if order is None:
        return None
    if transaction.status not in {"paid", "completed"}:
        transaction.status = status
        order.payment_status = status
        order.order_status = "cancelled"
        release_order_stock(db, order, order.created_by)
        db.commit()
    return order


def _order_id_for(tran_id: str, db: Session) -> str:
    transaction = db.query(Transaction).filter(Transaction.gateway_tran_id == tran_id).first()
    return str(transaction.sales_order_id) if transaction else ""


def _result_redirect(order_id: str | int, status: str) -> RedirectResponse:
    return RedirectResponse(
        f"{FRONTEND_BASE_URL}/payment/result?order_id={order_id}&status={status}",
        status_code=303,
    )


@router.post("/success")
async def payment_success(
    tran_id: str = Form(...), val_id: str = Form(...), db: Session = Depends(get_db),
):
    try:
        order = await _complete(tran_id, val_id, db)
    except Exception:
        # Never show raw API errors to a customer returning from the gateway; the
        # result page reads the real order state, and the IPN call can still confirm it.
        db.rollback()
        logger.exception("Could not confirm SSLCommerz payment %s", tran_id)
        return _result_redirect(_order_id_for(tran_id, db), "unverified")
    return _result_redirect(order.id, "success")


@router.post("/ipn")
async def payment_ipn(
    tran_id: str = Form(...), val_id: str = Form(...), db: Session = Depends(get_db),
):
    await _complete(tran_id, val_id, db)
    return PlainTextResponse("OK")


@router.post("/fail")
async def payment_fail(
    tran_id: str = Form(...), db: Session = Depends(get_db),
):
    order = await _fail(tran_id, "failed", db)
    return _result_redirect(order.id if order else "", "failed")


@router.post("/cancel")
async def payment_cancel(
    tran_id: str = Form(...), db: Session = Depends(get_db),
):
    order = await _fail(tran_id, "cancelled", db)
    return _result_redirect(order.id if order else "", "cancelled")
