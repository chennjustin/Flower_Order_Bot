# Spec: Messages Page — Right Panel Customer Order History

**Suggested branch:** `feat/messages-room-orders-list`  
**Scope:** Frontend only (messages page right sidebar)  
**Depends on:** PR #23 (`GET /orders/room/{room_id}`) merged into `main`

**Related specs (separate agents):**

- Dashboard order table: `docs/specs/dashboard-order-overview.md` (may already be implemented on `main`)
- Chat room status tag toggle: merged in PR #20 (`ChatHeader`)

---

## 1. Background

### 1.1 Page layout (Messages)

```
┌──────────┬─────────────────────────┬─────────────────┐
│ ChatList │ ChatRoom (messages)     │ DetailPanel     │
│ 360px    │ flex-1                  │ 336px           │
└──────────┴─────────────────────────┴─────────────────┘
```

- Entry: `frontend/src/pages/MessagesPage.tsx`
- Right panel opens when user clicks「整理資料」success or the chevron in `ChatHeader` (`showDetail === true`).
- Component: `frontend/src/components/messages/DetailPanel.tsx`

### 1.2 Current right panel behavior

The panel is titled **「訂單草稿」** and only handles **OrderDraft**:

| Feature | API | Status |
|---------|-----|--------|
| Load / edit draft fields | `GET/PATCH /orderdraft/{room_id}` | Done |
| Organize data (from header) | `PATCH /organize_data/{room_id}` | Done |
| Create formal order | `POST /order/{room_id}` | Done |
| Update formal order from draft | `PATCH /order/{room_id}` | Done (logic disputed — do not change) |

**Gap:** Store staff cannot see **past / other orders** for the same customer while chatting. Original product requirement:

> 聊天室頁面 — 查看該顧客的相關訂單（含狀態）

---

## 2. Goals

1. In the right panel (`DetailPanel`), add a **customer order history** section for the selected chat room.
2. Fetch orders via **`GET /orders/room/{room_id}`** (all orders for the room’s customer, **including cancelled**).
3. Display each order’s status using the **same order-domain labels** as the dashboard:

   | Backend `OrderStatus` | UI label |
   |----------------------|----------|
   | `CONFIRMED` / `PENDING` | 尚未製作 |
   | `COMPLETED` | 製作完成 |
   | `CANCELLED` | 取消 |

4. Reuse helpers from `frontend/src/utils/orderStatus.ts` (`orderStatusLabel`, `orderStatusBadgeClasses`, `normalizeOrderStatus`).

---

## 3. Non-Goals (Do NOT implement)

- Redesigning the **order draft** form or its edit/create/update buttons
- Changing **`PATCH /order/{room_id}`** (更新工單) business logic — still on hold per team decision
- Backend implementation of `GET /orders/room/{room_id}` (PR #23)
- Dashboard / home page changes
- Chat list or chat message UI changes
- Lead /「潛在客戶」pipeline on messages page
- Full order detail modal inside the panel (optional stretch goal — not required for v1)

---

## 4. Backend Contract (PR #23)

### 4.1 List orders by chat room

```
GET /orders/room/{room_id}
Response: OrderOut[]   (empty array if customer has no orders)
404: chat room not found
```

**Semantics (from backend service):**

- Resolve `room_id` → `ChatRoom.customer_id`
- Return **all** `Order` rows for that customer, sorted **`created_at` descending** (newest first)
- **Includes `CANCELLED`** orders (unlike `GET /orders`)

### 4.2 Order status update (optional v1 enhancement)

Already on `main`:

```
PATCH /order/{order_id}/status
Body: { "status": "CONFIRMED" | "COMPLETED" | "CANCELLED" | "PENDING" }
Response: OrderOut
```

If implementing status toggle in the list, reuse `updateOrderStatus` from `frontend/src/api/orders.ts` and `useUpdateOrderStatus` from `frontend/src/hooks/useOrders.ts` (already used by dashboard `OrderTable`).

### 4.3 Response shape (`OrderOut`)

Same as existing `Order` type in `frontend/src/types/domain.ts`:

```ts
interface Order {
  id: number
  order_date: string
  order_status: OrderStatus
  customer_name: string
  customer_phone: string
  item: string
  quantity: number
  total_amount: number
  send_datetime: string
  shipment_method: ShipmentMethod
  // ... optional: note, pay_way, pay_status, delivery_address
}
```

---

## 5. UI Specification

### 5.1 Panel structure (recommended)

Keep a **single scrollable panel** with two stacked sections (no tabs for v1):

```
┌─────────────────────────────┐
│ Header: 訂單草稿    [✎] [»] │  ← existing
├─────────────────────────────┤
│ (draft fields…)             │  ← existing, unchanged
│                             │
│ ─── 相關訂單 ─────────────── │  ← NEW section divider
│                             │
│ #12  玫瑰花束   [尚未製作]   │  ← compact list rows
│ #11  滿天星     [製作完成]   │
│ #9   …          [取消]       │
├─────────────────────────────┤
│ [更新工單] [建立新工單]      │  ← existing footer buttons
└─────────────────────────────┘
```

**Section title:** `相關訂單` (or `歷史訂單` — pick one, prefer **相關訂單**)

### 5.2 Order list row (compact)

Each row shows at minimum:

| Column | Source |
|--------|--------|
| 訂單編號 | `order.id` (prefix `#`) |
| 品項 | `order.item` (truncate with ellipsis) |
| 狀態 | badge via `orderStatusLabel(normalizeOrderStatus(order.order_status))` |

Optional (if space allows in 336px width):

- 取貨時間: `formatCellDateTime(order.send_datetime)` from `@/utils/datetime`
- 金額: `order.total_amount`

**Interaction (v1 minimum):** read-only list, no row click required.

**Interaction (v1 optional):** status Popover toggle per row — same 3 options as dashboard (`ORDER_STATUS_OPTIONS`). On success, invalidate room orders query.

### 5.3 Empty & loading states

| State | Copy |
|-------|------|
| Loading | `載入中...` (small text under section title) |
| Error | `無法載入相關訂單：{message}` (red, non-blocking — draft section still works) |
| Empty list | `此顧客尚無正式訂單` |

### 5.4 When to fetch

- Fetch when `DetailPanel` is `open === true` and `roomId` is set.
- Refetch when:
  - `roomId` changes
  - User successfully **建立新工單** (`POST /order/{room_id}` succeeds)
  - User successfully updates order status (if toggle implemented)
- Use TanStack Query with key e.g. `['chatRooms', roomId, 'orders']`.

### 5.5 Visual style

- Match existing `DetailPanel` typography: `font-['Noto_Sans_TC',sans-serif]`, bold labels
- Status badge colors: reuse `orderStatusBadgeClasses` (same as dashboard)
- Section divider: subtle border or spacing consistent with `border-[#e9e9e9]`
- Do **not** widen the panel beyond `w-[336px]` unless necessary; prefer compact rows

---

## 6. Implementation Checklist

### 6.1 New API client

**File:** `frontend/src/api/orders.ts`

```ts
export async function fetchOrdersByRoom(roomId: number): Promise<Order[]> {
  const { data } = await api.get<Order[]>(`/orders/room/${roomId}`)
  return data ?? []
}
```

### 6.2 New hook

**File:** `frontend/src/hooks/useRoomOrders.ts` (new) **or** extend `useOrders.ts`

```ts
export const roomOrdersQueryKey = (roomId: number) =>
  ['chatRooms', roomId, 'orders'] as const

export function useRoomOrders(roomId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: roomId == null ? ['chatRooms', 'pending', 'orders'] : roomOrdersQueryKey(roomId),
    queryFn: () => fetchOrdersByRoom(roomId as number),
    enabled: enabled && roomId != null,
  })
}
```

### 6.3 DetailPanel changes

**File:** `frontend/src/components/messages/DetailPanel.tsx`

1. Import `useRoomOrders` and order status helpers.
2. Call `useRoomOrders(roomId, open)`.
3. Render new **相關訂單** section below draft fields (inside scroll area, above footer buttons).
4. Extract presentational subcomponent if helpful: `RoomOrderList.tsx` in `frontend/src/components/messages/`.

### 6.4 Invalidate after create order

In `handleCreateOrder` success path, invalidate:

```ts
queryClient.invalidateQueries({ queryKey: roomOrdersQueryKey(roomId) })
```

Also consider invalidating `['orders']` so dashboard stays in sync.

### 6.5 Files to touch

| File | Action |
|------|--------|
| `frontend/src/api/orders.ts` | Add `fetchOrdersByRoom` |
| `frontend/src/hooks/useRoomOrders.ts` | New hook (recommended) |
| `frontend/src/components/messages/DetailPanel.tsx` | Add orders section |
| `frontend/src/components/messages/RoomOrderList.tsx` | New (optional extract) |

**Do not modify:** `DetailPanel` draft field logic, `ChatHeader`, `MessagesPage` layout (unless needed for query invalidation imports).

---

## 7. Reference: Existing draft panel (keep unchanged)

Key existing behaviors to preserve:

- Header title remains **「訂單草稿」**
- Pencil / check toggles draft edit mode
- Footer: **更新工單** + **建立新工單**
- Missing-field validation highlighting on create
- `useOrderDisplayConfig` field visibility for draft

---

## 8. Test Plan

Prerequisites: PR #23 merged; backend running; at least one chat room with customer who has 0+ orders.

- [ ] Open messages page, select a room, open right panel.
- [ ] Draft section behaves exactly as before.
- [ ] **相關訂單** section loads without blocking draft.
- [ ] Orders show correct status badges (尚未製作 / 製作完成 / 取消).
- [ ] Cancelled orders appear in list (if customer has any).
- [ ] Empty state when customer has no orders.
- [ ] After **建立新工單**, new order appears in list without full page reload.
- [ ] Switch to another chat room → list updates to that customer’s orders.
- [ ] `npm run build` passes.

---

## 9. Known Limitations

1. **PR #23 dependency:** Frontend will 404 until `GET /orders/room/{room_id}` is on `main`. Verify merge before testing.
2. **Customer scope, not room scope:** API returns all orders for the **customer**, not only orders created from this room’s `room_id`. This is intentional (backend design).
3. **更新工單:** Still uses latest confirmed order by room — unrelated to this list; do not conflate.
4. **No order detail drill-down in v1:** List is informational; full edit stays in draft + dashboard.

---

## 10. PR Guidelines

- Single PR, frontend only, 1–2 commits.
- Title suggestion: `feat: show customer order history in messages detail panel`
- Base branch: latest `main` (must include PR #23 backend + PR #21 status API + dashboard `orderStatus.ts` helpers)
- Mention dependency on PR #23 in PR description if merging before backend lands.
