from enum import Enum

class ShipmentMethod(str, Enum):
    STORE_PICKUP = "STORE_PICKUP"
    DELIVERY = "DELIVERY"