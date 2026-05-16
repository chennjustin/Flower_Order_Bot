import type { Db } from "../db/repositories.js";
import * as repo from "../db/repositories.js";

export async function getStats(db: Db) {
  const today_orders = await repo.countTodayOrders(db);
  const total_customers = await repo.countTotalCustomers(db);
  const monthly_income = await repo.sumMonthlyIncome(db);
  const pending_orders = await repo.countPendingOrders(db);
  return { today_orders, pending_orders, monthly_income, total_customers };
}
