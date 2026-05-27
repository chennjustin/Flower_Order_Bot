from typing import Optional
from datetime import datetime
from pydantic import BaseModel

from app.enums.order import OrderStatus
from app.enums.shipment import ShipmentMethod

"""
OrderDraft:
- OrderDraftBase
- OrderDraftUpdate
- OrderDraftCreate
- OrderDraftOut

Order:
- OrderBase
- OrderUpdate
- OrderOut
- OrderCreate
"""

class OrderDraftBase(BaseModel):
    # TODO: 待補目前付的錢

    # 訂購人（customer）資訊
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    # 舊欄位：僅為相容歷史 payload；目前 schema 不再落地 receiver 實體。
    receiver_name: Optional[str] = None
    receiver_phone: Optional[str] = None

    # 付款資訊
    total_amount: Optional[float] = None

    # 商品資訊
    item: Optional[str] = None
    quantity: Optional[int] = None
    note: Optional[str] = None

    # 運送資訊
    shipment_method: Optional[ShipmentMethod] = None
    send_datetime: Optional[datetime] = None
    delivery_address: Optional[str] = None

    class Config:
        from_attributes = True

class OrderDraftUpdate(OrderDraftBase):
    pay_way_id: Optional[int] = None
    pay_way: Optional[str] = None
    pass

class OrderDraftCreate(OrderDraftBase):
    pay_way_id: Optional[int] = None
    pay_way: Optional[str] = None
    pass

class OrderDraftOut(OrderDraftBase):
    id: int
    order_date: datetime
    pay_way: Optional[str] = None
    weekday: Optional[str] = None

"""
Order:
"""

class OrderBase(BaseModel):
    # TODO: 待補目前付的錢

    # 收件 / 寄件人
    customer_name: str
    customer_phone: str
    receiver_name: Optional[str] = None
    receiver_phone: Optional[str] = None

    # 付款資訊
    total_amount: float

    # 商品資訊
    item: str
    quantity: int
    note: Optional[str] = None

    # 運送資訊
    shipment_method: Optional[ShipmentMethod] = None
    # 取貨/送達時間：某些訂單（如店取未填時間）可能為空；列表/草稿需允許為 None
    send_datetime: Optional[datetime] = None
    delivery_address: Optional[str] = None

    class Config:
        from_attributes = True

class OrderUpdate(OrderBase):
    pay_way_id: Optional[int] = None
    pass

class OrderCreate(OrderBase):
    pay_way_id: Optional[int] = None
    pass

class OrderOut(OrderBase):
    id: int
    order_date: datetime
    order_status: OrderStatus
    pay_way: Optional[str] = None
    weekday: Optional[str] = None