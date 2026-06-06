# Spec: Dashboard Order Overview — Order-Only Status UI

**Branch:** `feat/dashboard-order-status-ui`  
**Scope:** Frontend only  
**Out of scope:** Backend changes, chat-room lead/pipeline UI, messages page changes

---

## 1. Background & Problem

The dashboard order table (`OrderTable`) currently **mixes chat-room statuses with order statuses** via `frontend/src/utils/orderStatus.ts`:

- `normalizeStatus()` maps backend `OrderStatus.CONFIRMED` → chat bucket `ORDER_CONFIRM` (displayed as「討論完成」).
- `PENDING`, `COMPLETED`, `CANCELLED` fall through to `WAITING_OWNER` (displayed as「人工溝通」).

This causes incorrect labels (e.g. a completed order shows as「人工溝通」) and filter tabs that belong to the **messages** domain (人工溝通、討論完成), not the **orders** domain.

**Product decision (confirmed):** For now, **ignore potential customers** (people still in chat-room「人工溝通」with no formal order). The dashboard and order table should show **orders only**, with **order-native status labels**.

---

## 2. Goals

1. Remove chat-room status vocabulary from the order table and dashboard filters.
2. Display order status as store-facing labels: **尚未製作**, **製作完成**, **取消**.
3. Allow store staff to **toggle** order status via existing backend API `PATCH /order/{order_id}/status`.
4. Replace the misleading「溝通中訂單」stats card behavior with order-focused metrics (or disable its filter link).

---

## 3. Non-Goals (Do NOT implement in this task)

- Chat-room lead list /「潛在客戶」on dashboard
- `GET /orders/room/{room_id}` UI (separate future task; PR #23 backend)
- Refactoring「更新工單」(`PATCH /order/{room_id}`) business logic
- Backend changes to `GET /orders` filter behavior (cancelled orders still hidden from list API)
- Messages page (`ChatHeader` status switcher — already done in PR #20)

---

## 4. Backend Contract (already on `main`)

### 4.1 List orders

```
GET /orders
Response: OrderOut[] | null
```

- Returns active orders only (`status != CANCELLED`).
- Each item includes `order_status: OrderStatus` (`PENDING` | `CONFIRMED` | `CANCELLED` | `COMPLETED`).

### 4.2 Update order status (toggle target)

```
PATCH /order/{order_id}/status
Body: { "status": "CONFIRMED" | "CANCELLED" | "COMPLETED" | "PENDING" }
Response: OrderOut
```

- Store toggle should send **`CONFIRMED`**, **`COMPLETED`**, or **`CANCELLED`** only.
- After setting `CANCELLED`, the order **disappears** from `GET /orders` (expected until backend list API changes).

### 4.3 Delete order (legacy — prefer status API)

```
DELETE /order/{order_id}
```

- Also sets status to `CANCELLED`. **Remove** separate「刪除」column; use status toggle「取消」instead.

---

## 5. Status Mapping (Order Domain)

| Backend `OrderStatus` | UI label (繁中) | Filter bucket | Toggle option |
|----------------------|-----------------|---------------|---------------|
| `CONFIRMED`          | 尚未製作        | `in_progress` | Yes           |
| `PENDING`            | 尚未製作        | `in_progress` | Yes (normalize to CONFIRMED on toggle) |
| `COMPLETED`          | 製作完成        | `completed`   | Yes           |
| `CANCELLED`          | 取消            | (hidden from list) | Yes      |

**Note:** New orders are created with `CONFIRMED` (see `create_order_by_room` in backend). `PENDING` may exist from legacy data; treat display same as `CONFIRMED`.

---

## 6. UI Specification

### 6.1 Order table filter tabs

Replace current tabs in `OrderTable.tsx`:

| Remove | Replace with |
|--------|--------------|
| 人工溝通 (`WAITING_OWNER`) | **尚未製作** (`in_progress`) |
| 討論完成 (`ORDER_CONFIRM`) | **製作完成** (`completed`) |
| 所有訂單 | 所有訂單 (keep) |
| 今日訂單 | 今日訂單 (keep) |

Filter logic:

- **所有訂單:** no status filter (still excludes CANCELLED — comes from API).
- **尚未製作:** `order_status` is `CONFIRMED` or `PENDING`.
- **製作完成:** `order_status` is `COMPLETED`.
- **今日訂單:** filter by `send_datetime` date (existing behavior).

### 6.2 Status column — toggle (Popover)

Replace read-only badge + separate「取消訂單」delete column with a **single Popover toggle** (same interaction pattern as `ChatHeader` status switcher in PR #20).

- **Trigger:** badge showing current label + chevron.
- **Options (3):**
  1. 尚未製作 → `CONFIRMED`
  2. 製作完成 → `COMPLETED`
  3. 取消 → `CANCELLED`
- On select: call `PATCH /order/{order_id}/status`, invalidate `['orders']` and `['stats']` queries.
- Stop row click propagation on toggle (row opens `OrderDetailDialog`).
- Disable trigger while mutation pending.

**Remove:** `cancel` column from `COLUMNS`, delete confirmation `Dialog`, `useDeleteOrder` usage in `OrderTable`.

### 6.3 Status badge colors

Suggested palette (match existing design language):

| Status   | Classes (reference) |
|----------|---------------------|
| 尚未製作 | `bg-[#C5C7FF] text-[#6168FC]` |
| 製作完成 | `bg-[#D8EAFF] text-[#528DD2]` |
| 取消     | `bg-[#EBCDCC] text-[#81386A]` |

### 6.4 Dashboard statistics cards (`StatisticsCards.tsx`)

Current card「溝通中訂單」uses `stats.pending_orders` (backend counts `PENDING` orders only) and filters table to chat bucket `WAITING_OWNER` — **wrong**.

**Change to:**

| Card | Label | Count source | Click behavior |
|------|-------|--------------|----------------|
| 今日製作 | keep | `stats.today_orders` | filter → 今日訂單 (keep) |
| ~~溝通中訂單~~ → **尚未製作** | 尚未製作 | Count from `useOrders()` client-side: orders where status is `CONFIRMED` or `PENDING` | filter → 尚未製作 tab |
| 本月訂單 | keep | client-side monthly count | no filter (keep non-clickable) |
| 本月營業額 | keep | `stats.monthly_income` | no filter (keep non-clickable) |

Update `QuickFilter` type in `DashboardPage.tsx`:

```ts
// Before
type QuickFilter = 'today' | 'pending' | null

// After
type QuickFilter = 'today' | 'in_progress' | null
```

Pass `inProgressOrders` count from `DashboardPage` to `StatisticsCards` (computed from orders query).

Icon: replace `MessageCircle` with something order-related (e.g. `Package` from lucide-react).

### 6.5 Calendar view (`CalendarView.tsx`)

Update to use new order status helpers (not `normalizeStatus` / `statusText` from chat buckets).

- Pill colors and tooltips should show 尚未製作 / 製作完成 / 取消.

### 6.6 Orders page (`/order`)

`OrdersPage.tsx` renders the same `OrderTable` with `showTitle={false}`. **All changes apply there too** — no separate implementation.

---

## 7. File Change Checklist

| File | Action |
|------|--------|
| `frontend/src/utils/orderStatus.ts` | **Rewrite** for order domain only. Remove `ChatStatus`, `normalizeStatus`, `CHAT_STATUS_TABS`. Add `normalizeOrderStatus`, `orderStatusLabel`, `orderStatusBadgeClasses`, `ORDER_STATUS_OPTIONS`, `ORDER_FILTER_TABS`, `isInProgressOrder`. Keep `shipmentLabel`. |
| `frontend/src/api/orders.ts` | Add `updateOrderStatus(orderId, status)` → `PATCH /order/{id}/status` |
| `frontend/src/hooks/useOrders.ts` | Add `useUpdateOrderStatus()` mutation |
| `frontend/src/components/orders/OrderTable.tsx` | Filter tabs, status toggle, remove delete column/dialog |
| `frontend/src/components/orders/CalendarView.tsx` | Use new order status helpers |
| `frontend/src/pages/DashboardPage.tsx` | `QuickFilter` rename, compute `inProgressOrders` |
| `frontend/src/components/stats/StatisticsCards.tsx` | Replace 溝通中訂單 card |
| `frontend/src/pages/StatsPage.tsx` | Pass new `inProgressOrders` prop (can pass `0` if no orders query) |

**Do not modify:** `statusMapping.ts` (chat room domain), messages components, backend.

---

## 8. Reference Implementation Sketch

### `orderStatus.ts` (new exports)

```ts
export const ORDER_STATUS_OPTIONS = [
  { value: 'CONFIRMED', label: '尚未製作' },
  { value: 'COMPLETED', label: '製作完成' },
  { value: 'CANCELLED', label: '取消' },
] as const

export const ORDER_FILTER_TABS = [
  { value: '', label: '所有訂單' },
  { value: 'in_progress', label: '尚未製作' },
  { value: 'completed', label: '製作完成' },
  { value: 'today', label: '今日訂單' },
] as const
```

### API client

```ts
export async function updateOrderStatus(
  orderId: number,
  status: OrderStatus,
): Promise<Order> {
  const { data } = await api.patch<Order>(`/order/${orderId}/status`, { status })
  return data
}
```

---

## 9. Test Plan

Manual QA on dashboard (`/`):

- [ ] Filter tabs show 所有訂單 / 尚未製作 / 製作完成 / 今日訂單 — **no** 人工溝通 or 討論完成.
- [ ] Order with `CONFIRMED` displays badge「尚未製作」.
- [ ] Order with `COMPLETED` displays badge「製作完成」.
- [ ] Click status badge → popover with 3 options → switch to 製作完成 → badge updates after refresh.
- [ ] Switch to 取消 → order disappears from table (API excludes cancelled).
- [ ]「尚未製作」stats card count matches filtered table rows.
- [ ] Click「尚未製作」card → table filters to in-progress orders.
- [ ] Calendar view pills show correct order status labels.
- [ ] `/order` page behaves identically.
- [ ] `npm run build` passes.

---

## 10. Known Limitations (document, do not fix in this task)

1. **Cancelled orders invisible:** `GET /orders` filters out `CANCELLED`. Toggle to 取消 removes row; no way to view cancelled orders on dashboard until backend changes.
2. **`PENDING` enum:** Rare; displayed as 尚未製作. Toggle always writes `CONFIRMED` for the「尚未製作」option.
3. **Chat-room leads:** Customers in 人工溝通 without a formal order are intentionally not shown anywhere on dashboard.

---

## 11. PR Guidelines

- Single focused PR from `feat/dashboard-order-status-ui` → `main`.
- Frontend only; one commit preferred.
- Title suggestion: `feat: order-only status filters and toggle on dashboard`
- Depends on backend `PATCH /order/{order_id}/status` (already merged in PR #21).
