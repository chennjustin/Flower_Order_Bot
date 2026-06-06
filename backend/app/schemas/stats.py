from pydantic import BaseModel

class StatsOut(BaseModel):
    today_orders: int
    today_completed: int
    pending_orders: int
    in_progress_orders: int
    monthly_income: float
    monthly_orders: int
    total_customers: int
