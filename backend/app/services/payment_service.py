
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.models.payment import PaymentMethod
from app.schemas.payment import PaymentMethodBase
from app.repositories.payment_repository import (
    get_payment_method_by_id as repo_get_payment_method_by_id,
    get_payment_method_by_order_id,
    list_payment_methods,
    save_payment_method,
)


def payment_method_to_base(method) -> PaymentMethodBase:
    return PaymentMethodBase(
        id=method.id,
        code=method.code,
        display_name=method.display_name,
        display_image_url=method.display_image_url,
        instructions=method.instructions,
        requires_manual_confirm=method.requires_manual_confirm,
        active=method.active,
    )

async def get_all_payment_methods(db: AsyncSession) -> Optional[list[PaymentMethodBase]]:
    payment_methods = await list_payment_methods(db)

    return [
        payment_method_to_base(method) for method in payment_methods if method.active
    ]


async def get_pay_way_by_order_id(db: AsyncSession, order_id: int) -> PaymentMethod:
    return await get_payment_method_by_order_id(db, order_id)

async def get_payment_method_by_id(db: AsyncSession, payment_method_id: int) -> Optional[PaymentMethod]:
    return await repo_get_payment_method_by_id(db, payment_method_id)

async def toggle_payment_method_active(db: AsyncSession, payment_method_id: int) -> Optional[PaymentMethodBase]:
    payment_method = await get_payment_method_by_id(db, payment_method_id) 
    if not payment_method:
        return None
    payment_method.active = not payment_method.active
    payment_method = await save_payment_method(db, payment_method)
    return payment_method_to_base(payment_method)