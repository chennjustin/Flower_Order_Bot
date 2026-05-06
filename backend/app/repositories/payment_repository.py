from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment import Payment, PaymentMethod


async def list_payment_methods(db: AsyncSession) -> list[PaymentMethod]:
    stmt = select(PaymentMethod)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_payment_method_by_id(
    db: AsyncSession, payment_method_id: int
) -> Optional[PaymentMethod]:
    stmt = select(PaymentMethod).where(PaymentMethod.id == payment_method_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_payment_method_by_order_id(
    db: AsyncSession, order_id: int
) -> Optional[PaymentMethod]:
    stmt = (
        select(Payment, PaymentMethod)
        .join(PaymentMethod, Payment.method_id == PaymentMethod.id)
        .where(Payment.order_id == order_id)
        .limit(1)
    )
    result = await db.execute(stmt)
    row = result.first()
    if row is None:
        return None
    return row[1]


async def save_payment_method(
    db: AsyncSession, payment_method: PaymentMethod
) -> PaymentMethod:
    db.add(payment_method)
    await db.commit()
    await db.refresh(payment_method)
    return payment_method

