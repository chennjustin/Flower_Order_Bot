# Flower Shop Automation System — API Reference

Backend API for the flower shop automation system (花店自動化系統). All routes are served by **FastAPI** with no `/api/v1` URL prefix.

**Interactive docs:** Swagger UI at `GET /` · OpenAPI schema at `GET /openapi.json` · ReDoc at `GET /redoc`

---

## Table of Contents

1. [Introduction](#introduction)
2. [Authentication](#authentication)
3. [Shared Enums and Schemas](#shared-enums-and-schemas)
4. [Error Responses](#error-responses)
5. [Endpoints](#endpoints)
   - [Health](#health)
   - [Stores](#stores)
   - [Orders](#orders)
   - [Order DOCX Export](#order-docx-export)
   - [Organize Data (LLM)](#organize-data-llm)
   - [Chat Rooms](#chat-rooms)
   - [Statistics](#statistics)
   - [Payment Methods](#payment-methods)
   - [Order Field Config](#order-field-config)
   - [Google Calendar](#google-calendar)
   - [LINE Webhook](#line-webhook)
   - [Dev / Seeding](#dev--seeding)
   - [Static Uploads](#static-uploads)
6. [Special Topics](#special-topics)
7. [Example Requests](#example-requests)

---

## Introduction

| Item | Value |
|---|---|
| Framework | FastAPI |
| Default content type | `application/json` |
| Base URL (dev) | `http://localhost:8000` (configurable) |
| CORS | Permissive (`allow_origins=["*"]`) |

**Path naming note:** Order routes use both `/order/` (singular) and `/orders/` (plural). Both are active; use the exact paths documented below.

---

## Authentication

There is **no backend login endpoint**. Access tokens are issued by **Supabase Auth** on the frontend. The backend validates tokens by calling Supabase's `GET /auth/v1/user`.

### Auth types

| Type | Header / Param | Used by |
|---|---|---|
| **Supabase Bearer** | `Authorization: Bearer <access_token>` | Most staff/store-owner endpoints |
| **Bearer or query token** | `Authorization: Bearer <token>` **or** `?access_token=<token>` | SSE endpoints (EventSource cannot set headers) |
| **LINE signature** | `X-Line-Signature` | `POST /callback` |
| **Google OAuth state JWT** | `state` query param on callback | `GET /google/calendar/callback` |
| **None** | — | `/health`, `GET /stores`, `GET /generate-fake-data`, and 3 order endpoints (see [Security Notes](#security-notes)) |

### Store scoping

Authenticated endpoints automatically scope data to the store bound to the logged-in owner (`owner_auth_user_id` or first-login email claim). Routes that accept a `{store_id}` path parameter additionally verify it matches the logged-in store.

---

## Shared Enums and Schemas

### Enums

**OrderStatus** (`app/enums/order.py`)

| Value | Description |
|---|---|
| `PENDING` | Order created, awaiting confirmation |
| `CONFIRMED` | Confirmed by store |
| `CANCELLED` | Cancelled |
| `COMPLETED` | Completed |
| `FULFILLED` | Fulfilled / delivered |

**PaymentStatus** (`app/enums/payment.py`)

| Value |
|---|
| `PENDING` |
| `PAID` |
| `FAILED` |
| `REFUNDED` |

**ShipmentMethod** (`app/enums/shipment.py`)

| Value |
|---|
| `STORE_PICKUP` |
| `DELIVERY` |

**ChatRoomStage** (`app/enums/chat.py`)

| Value |
|---|
| `WELCOME` |
| `IDLE` |
| `ORDER_CONFIRM` |
| `WAITING_OWNER` |
| `BOT_ACTIVE` |

**ChatMessageDirection**

| Value |
|---|
| `INCOMING` |
| `OUTGOING_BY_BOT` |
| `OUTGOING_BY_STORE` |
| `OUTGOING_BY_STAFF` (legacy alias for `OUTGOING_BY_STORE`) |

**ChatMessageStatus**

| Value |
|---|
| `SENT` |
| `PENDING` |
| `FAILED` |

### Key response schemas

**OrderOut**

```json
{
  "id": 1,
  "order_date": "2026-06-14T10:00:00",
  "order_status": "PENDING",
  "customer_name": "Alice",
  "customer_phone": "0912345678",
  "total_amount": 1500.0,
  "pay_status": "PENDING",
  "item": "Rose bouquet",
  "quantity": 1,
  "note": "Happy birthday",
  "shipment_method": "DELIVERY",
  "send_datetime": "2026-06-15T14:00:00",
  "delivery_address": "123 Main St",
  "pay_way": "LINE Pay"
}
```

**OrderListOut**

```json
{
  "items": [/* OrderOut[] */],
  "total": 42,
  "page": 1,
  "page_size": 20
}
```

**OrderDraftOut** — same fields as order draft base plus `id`, `order_date`, `pay_way`. All draft fields are optional.

**OrderDraftUpdate** — partial draft update; all fields optional. Includes `pay_way_id` and `pay_way`.

**OrderPatchUpdate** — partial formal order update. All fields optional. Includes `order_status` and `mark_processed_message_ids` (chat message IDs to mark processed after save).

**OrderStatusUpdate**

```json
{ "status": "CONFIRMED" }
```

**OrganizeOrderDraftOut**

```json
{
  "draft": { /* OrderDraftOut */ },
  "changed_fields": ["customer_name", "item"],
  "source_message_ids": [101, 102]
}
```

**OrderSuggestFromChatOut**

```json
{
  "suggested": { /* OrderPatchUpdate */ },
  "changed_fields": ["note"],
  "source_message_ids": [103]
}
```

**StoreListItem**

```json
{
  "id": 1,
  "name": "My Flower Shop",
  "slug": "my-flower-shop",
  "onboarding_done": true
}
```

**StoreOnboardingContext**

```json
{
  "id": 1,
  "name": "My Flower Shop",
  "slug": "my-flower-shop",
  "line_official": {
    "display_name": "My Flower Shop",
    "basic_id": "@myshop",
    "user_id": "Uabc123",
    "image_url": "https://..."
  }
}
```

**ChatRoomOut**

```json
{
  "room_id": 1,
  "user_name": "Customer",
  "user_avatar_url": "https://...",
  "unread_count": 2,
  "status": "BOT_ACTIVE",
  "last_message": {
    "text": "Hello",
    "timestamp": "2026-06-14T10:00:00"
  }
}
```

**ChatRoomListOut**

```json
{
  "items": [/* ChatRoomOut[] */],
  "total": 10,
  "total_unread": 5,
  "filtered_unread_rooms": 3,
  "has_more": true
}
```

**ChatMessageOut**

```json
{
  "id": 1,
  "user_avatar_url": "https://...",
  "direction": "INCOMING",
  "message": {
    "text": "Hello",
    "image_url": null,
    "sticker_package_id": null,
    "sticker_id": null
  },
  "status": "SENT",
  "created_at": "2026-06-14T10:00:00"
}
```

**ChatMessageCreate** — exactly one of: `text`, `image_url`, or both `sticker_package_id` + `sticker_id`.

**StatsOut**

```json
{
  "today_orders": 5,
  "today_completed": 2,
  "pending_orders": 3,
  "in_progress_orders": 4,
  "monthly_income": 50000.0,
  "monthly_orders": 120,
  "total_customers": 80
}
```

**PaymentMethodBase**

```json
{
  "id": 1,
  "active": true,
  "code": "LINE_PAY",
  "display_name": "LINE Pay",
  "display_image_url": "https://...",
  "instructions": "Scan QR code to pay",
  "requires_manual_confirm": true
}
```

**OrderFieldConfigOut**

```json
{
  "store_id": 1,
  "visible_fields": ["customer_name", "item", "quantity"],
  "field_order": ["customer_name", "item", "quantity", "note"],
  "organize_required_fields": ["customer_name", "item"],
  "fixed_visible_fields": ["customer_name"],
  "optional_visible_fields": ["note"],
  "optional_organize_fields": ["delivery_address"]
}
```

**OrderFieldConfigUpdate** — partial update; only sent fields are applied: `visible_fields`, `field_order`, `organize_required_fields`.

---

## Error Responses

FastAPI returns JSON error bodies in the standard shape:

```json
{ "detail": "Error message or validation array" }
```

| Status | Meaning |
|---|---|
| `400` | Bad request (invalid input, missing LINE signature, calendar not connected) |
| `401` | Missing or invalid Bearer token |
| `403` | Authenticated but not authorized (wrong store or resource ownership) |
| `404` | Resource not found |
| `413` | Upload too large (chat images > 5 MB) |
| `422` | Validation error (Pydantic) |
| `500` | Server error (e.g. DOCX template missing) |
| `503` | Dependency unavailable (auth service, Supabase Storage, Google Calendar not configured) |

---

## Endpoints

### Health

#### `GET /health`

| | |
|---|---|
| **Auth** | None |
| **Description** | Liveness check |

**Response:** `200` — `text/plain` body `"OK"`

---

### Stores

Source: `app/routes/stores.py`

#### `GET /stores/me`

| | |
|---|---|
| **Auth** | Supabase Bearer → store |
| **Description** | Return the store bound to the logged-in owner |

**Response:** `200` — `StoreListItem`

---

#### `PATCH /stores/me/onboarding-done`

| | |
|---|---|
| **Auth** | Supabase Bearer → store |
| **Description** | Mark onboarding as completed |

**Response:** `200` — `StoreListItem`

---

#### `GET /stores/me/onboarding-context`

| | |
|---|---|
| **Auth** | Supabase Bearer → store |
| **Description** | Onboarding display context including LINE official account info |

**Response:** `200` — `StoreOnboardingContext`

---

#### `PATCH /stores/me/name`

| | |
|---|---|
| **Auth** | Supabase Bearer → store |
| **Description** | Update store display name |

**Request body:** `StoreNameUpdateRequest`

```json
{ "name": "New Shop Name" }
```

| Field | Type | Constraints |
|---|---|---|
| `name` | string | 1–32 characters |

**Response:** `200` — `StoreNameUpdateResponse` `{ "name": "..." }`

---

#### `GET /stores`

| | |
|---|---|
| **Auth** | None |
| **Description** | List all stores (multi-tenant picker) |

**Response:** `200` — `StoreListItem[]`

---

### Orders

Source: `app/routes/orders.py`

#### `GET /orders`

| | |
|---|---|
| **Auth** | Supabase Bearer → store |
| **Description** | Paginated order list with filters |

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | int | `1` | Page number (≥ 1) |
| `page_size` | int | `20` | Items per page (1–500) |
| `status` | string | — | `in_progress`, `completed`, or `fulfilled` |
| `pickup_date` | date | — | Filter by pickup date (`YYYY-MM-DD`) |
| `pickup_from` | datetime | — | Pickup window start |
| `pickup_to` | datetime | — | Pickup window end |
| `q` | string | — | Search query |
| `include_cancelled` | bool | `false` | Include cancelled orders |

**Response:** `200` — `OrderListOut`

---

#### `GET /orders/export.csv`

| | |
|---|---|
| **Auth** | Supabase Bearer → store |
| **Description** | Export filtered orders as CSV |

**Query parameters:** Same as `GET /orders` (no pagination params).

**Response:** `200` — `text/csv; charset=utf-8` with UTF-8 BOM, `Content-Disposition: attachment; filename="orders.csv"`

---

#### `POST /orders/direct`

| | |
|---|---|
| **Auth** | Supabase Bearer → store |
| **Description** | Create a formal order without a chat room |

**Request body:** `OrderPatchUpdate` (partial fields)

**Response:** `200` — `OrderOut`

---

#### `GET /orders/room/{room_id}`

| | |
|---|---|
| **Auth** | **None** |
| **Description** | Get all orders for a chat room |

**Path parameters:** `room_id` (int)

**Response:** `200` — `OrderOut[]`

> **Security note:** This endpoint does not require authentication. See [Security Notes](#security-notes).

---

#### `DELETE /order/{order_id}`

| | |
|---|---|
| **Auth** | Supabase Bearer → store + order ownership |
| **Description** | Delete an order |

**Path parameters:** `order_id` (int)

**Response:** `200` — `bool`

---

#### `PATCH /orders/{order_id}`

| | |
|---|---|
| **Auth** | **None** |
| **Description** | Partial update of a formal order |

**Path parameters:** `order_id` (int)

**Request body:** `OrderPatchUpdate`

**Response:** `200` — `OrderOut`

> **Security note:** This endpoint does not require authentication. See [Security Notes](#security-notes).

---

#### `POST /orders/{order_id}/suggest-from-chat`

| | |
|---|---|
| **Auth** | **None** |
| **Description** | LLM preview of order updates from chat history (no database write) |

**Path parameters:** `order_id` (int)

**Response:** `200` — `OrderSuggestFromChatOut`

> **Security note:** This endpoint does not require authentication. See [Security Notes](#security-notes).

---

#### `PATCH /order/{order_id}/status`

| | |
|---|---|
| **Auth** | Supabase Bearer → store + order ownership |
| **Description** | Update order status (manual store action) |

**Path parameters:** `order_id` (int)

**Request body:** `OrderStatusUpdate`

**Response:** `200` — `OrderOut`

---

#### `POST /order/{room_id}`

| | |
|---|---|
| **Auth** | Supabase Bearer → store + room ownership |
| **Description** | Create order from chat room |

**Path parameters:** `room_id` (int)

**Response:** `200` — `string[]` (status messages)

---

#### `PATCH /order/{room_id}`

| | |
|---|---|
| **Auth** | Supabase Bearer → store + room ownership |
| **Description** | Update/sync order from chat room |

**Path parameters:** `room_id` (int)

**Response:** `200` — `bool`

---

#### `GET /orderdraft/{room_id}`

| | |
|---|---|
| **Auth** | Supabase Bearer → store + room ownership |
| **Description** | Get order draft for a chat room |

**Path parameters:** `room_id` (int)

**Response:** `200` — `OrderDraftOut` or `null`

---

#### `PATCH /orderdraft/{room_id}`

| | |
|---|---|
| **Auth** | Supabase Bearer → store + room ownership |
| **Description** | Update order draft |

**Path parameters:** `room_id` (int)

**Request body:** `OrderDraftUpdate`

**Response:** `200` — `OrderDraftOut` or `null`

---

### Order DOCX Export

Source: `app/routes/export_docx.py`

#### `GET /orders/{order_id}.docx`

| | |
|---|---|
| **Auth** | Supabase Bearer → store + order ownership |
| **Description** | Render work-order DOCX from template |

**Path parameters:** `order_id` (int)

**Response:** `200` — `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

`Content-Disposition: attachment; filename=order_{order_id}.docx`

Template: `backend/docs/工單模板.docx` (override via `DOCX_TEMPLATE_FILE` env var).

---

### Organize Data (LLM)

Source: `app/routes/organize_data.py`

#### `PATCH /organize_data/{room_id}`

| | |
|---|---|
| **Auth** | Supabase Bearer → store + room ownership |
| **Description** | LLM-organize order draft from chat messages |

**Path parameters:** `room_id` (int)

**Response:** `200` — `OrganizeOrderDraftOut`

---

### Chat Rooms

Source: `app/routes/messages.py` (prefix `/chat_rooms`)

#### `GET /chat_rooms/stream`

| | |
|---|---|
| **Auth** | Bearer or `?access_token=` → store |
| **Description** | SSE stream for store-scoped chat room list updates |

**Response:** `200` — `text/event-stream`

See [Server-Sent Events (SSE)](#server-sent-events-sse).

---

#### `GET /chat_rooms/{room_id}/stream`

| | |
|---|---|
| **Auth** | Bearer or `?access_token=` → store + room ownership |
| **Description** | SSE stream for single-room message events |

**Path parameters:** `room_id` (int)

**Response:** `200` — `text/event-stream`

---

#### `GET /chat_rooms`

| | |
|---|---|
| **Auth** | Supabase Bearer → store |
| **Description** | Paginated chat room list |

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | int | `30` | Page size (1–100) |
| `offset` | int | `0` | Offset (≥ 0) |
| `stage` | `ChatRoomStage` | — | Filter by stage |
| `q` | string | — | Search query |

**Response:** `200` — `ChatRoomListOut`

---

#### `GET /chat_rooms/{room_id}/messages`

| | |
|---|---|
| **Auth** | Supabase Bearer → store + room ownership |
| **Description** | Get messages for a room |

**Path parameters:** `room_id` (int)

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `after` | datetime | Return messages after this timestamp |

**Response:** `200` — `ChatMessageOut[]`

---

#### `POST /chat_rooms/{room_id}/mark_read`

| | |
|---|---|
| **Auth** | Supabase Bearer → store + room ownership |
| **Description** | Mark room as read |

**Path parameters:** `room_id` (int)

**Response:** `200`

```json
{ "message": "success", "cleared_unread": 3 }
```

---

#### `POST /chat_rooms/{room_id}/messages/upload_image`

| | |
|---|---|
| **Auth** | Supabase Bearer → store + room ownership |
| **Description** | Upload staff image to Supabase Storage |

**Path parameters:** `room_id` (int)

**Request:** `multipart/form-data` with field `file`

| Constraint | Value |
|---|---|
| Max size | 5 MB |
| Allowed types | `image/jpeg`, `image/png`, `image/gif`, `image/webp` |

**Response:** `200` — `StaffChatImageUploadOut` `{ "image_url": "https://..." }`

See [File Uploads](#file-uploads).

---

#### `POST /chat_rooms/{room_id}/messages`

| | |
|---|---|
| **Auth** | Supabase Bearer → store + room ownership |
| **Description** | Staff sends message to customer via LINE |

**Path parameters:** `room_id` (int)

**Request body:** `ChatMessageCreate` — exactly one payload type:

```json
{ "text": "Your order is ready!" }
```

```json
{ "image_url": "https://..." }
```

```json
{ "sticker_package_id": "1", "sticker_id": "1" }
```

**Response:** `200` — `ChatMessageOut`

---

#### `POST /chat_rooms/{room_id}/switch_mode`

| | |
|---|---|
| **Auth** | Supabase Bearer → store + room ownership |
| **Description** | Switch chat room stage/mode |

**Path parameters:** `room_id` (int)

**Request body:** `SwitchModeBody`

```json
{ "stage": "WAITING_OWNER" }
```

**Response:** `200` — `{ "message": "success" }`

---

### Statistics

Source: `app/routes/statistics.py`

#### `GET /stats`

| | |
|---|---|
| **Auth** | Supabase Bearer → store |
| **Description** | Dashboard statistics |

**Response:** `200` — `StatsOut`

---

### Payment Methods

Source: `app/routes/payment.py`

#### `GET /payment_methods`

| | |
|---|---|
| **Auth** | Supabase Bearer → store |
| **Description** | List store payment methods |

**Response:** `200` — `PaymentMethodBase[]`

---

#### `PATCH /payment_methods/{payment_method_id}`

| | |
|---|---|
| **Auth** | Supabase Bearer → store + method ownership |
| **Description** | Toggle payment method active flag |

**Path parameters:** `payment_method_id` (int)

**Response:** `200` — `PaymentMethodBase`

---

#### `GET /payment_methods/{payment_method_id}`

| | |
|---|---|
| **Auth** | Supabase Bearer → store + method ownership |
| **Description** | Get a single payment method |

**Path parameters:** `payment_method_id` (int)

**Response:** `200` — `PaymentMethodBase`

---

### Order Field Config

Source: `app/routes/order_field_config.py`

#### `GET /stores/{store_id}/order-field-config`

| | |
|---|---|
| **Auth** | Supabase Bearer → own store only |
| **Description** | Get order field visibility config |

**Path parameters:** `store_id` (int) — must match logged-in store

**Response:** `200` — `OrderFieldConfigOut`

---

#### `PUT /stores/{store_id}/order-field-config`

| | |
|---|---|
| **Auth** | Supabase Bearer → own store only |
| **Description** | Update order field config |

**Path parameters:** `store_id` (int) — must match logged-in store

**Request body:** `OrderFieldConfigUpdate`

**Response:** `200` — `OrderFieldConfigOut`

---

#### `GET /store/order-field-config/default`

| | |
|---|---|
| **Auth** | Supabase Bearer → store |
| **Description** | Get config for logged-in store (frontend alias) |

**Response:** `200` — `OrderFieldConfigOut`

---

#### `PUT /store/order-field-config/default`

| | |
|---|---|
| **Auth** | Supabase Bearer → store |
| **Description** | Update config for logged-in store |

**Request body:** `OrderFieldConfigUpdate`

**Response:** `200` — `OrderFieldConfigOut`

---

### Google Calendar

Source: `app/routes/google_calendar.py` (prefix `/google/calendar`)

#### `GET /google/calendar/connect`

| | |
|---|---|
| **Auth** | Supabase Bearer → store |
| **Description** | Start Google OAuth; returns consent URL |

**Response:** `200` — `ConnectUrlOut`

```json
{ "authorization_url": "https://accounts.google.com/o/oauth2/auth?..." }
```

---

#### `GET /google/calendar/callback`

| | |
|---|---|
| **Auth** | Public (JWT `state` validates store) |
| **Description** | OAuth callback; stores encrypted refresh token |

**Query parameters:** `code`, `state`, `error` (from Google redirect)

**Response:** `302 Redirect` to frontend:

| Result | Redirect |
|---|---|
| Success | `{frontend_base_url}/settings/integrations?calendar=connected` |
| Error | `?calendar=error` |
| Missing scope | `?calendar=missing_scope` |

---

#### `GET /google/calendar/status`

| | |
|---|---|
| **Auth** | Supabase Bearer → store |
| **Description** | Calendar connection status |

**Response:** `200` — `CalendarStatusOut`

```json
{ "connected": true, "email": "owner@gmail.com" }
```

---

#### `POST /google/calendar/sync-existing`

| | |
|---|---|
| **Auth** | Supabase Bearer → store |
| **Description** | Backfill existing orders to Google Calendar |

**Response:** `200` — `BackfillResultOut`

```json
{ "synced": 15, "total": 20 }
```

Returns `400` if calendar is not connected.

---

#### `POST /google/calendar/disconnect`

| | |
|---|---|
| **Auth** | Supabase Bearer → store |
| **Description** | Revoke token and disconnect calendar |

**Response:** `200` — `CalendarStatusOut` `{ "connected": false, "email": null }`

---

### LINE Webhook

Source: `app/routes/linebot.py`

#### `POST /callback`

| | |
|---|---|
| **Auth** | LINE signature (`X-Line-Signature`) |
| **Description** | LINE Messaging API webhook |

**Headers:**

| Header | Required |
|---|---|
| `X-Line-Signature` | Yes |

**Request body:** Raw LINE webhook JSON (text, image, sticker messages; follow events)

**Response:** `200` — `text/plain` `"OK"`

Store is resolved from the webhook body. Invalid or missing signature returns `400`.

---

### Dev / Seeding

Source: `app/routes/generate_fake_data.py`

#### `GET /generate-fake-data`

| | |
|---|---|
| **Auth** | None |
| **Description** | Seed 10 fake orders on store `id=1` |

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `count` | int | Ignored (kept for Swagger compatibility) |

**Response:** `200` — `text/plain` `"OK: created 10 orders"`

Returns `400` on runtime error (e.g. store not found).

---

### Static Uploads

Source: `app/main.py`

#### `GET /uploads/{path}`

| | |
|---|---|
| **Auth** | None |
| **Description** | Serve uploaded files from `backend/uploads/` |

Not a REST API endpoint; static file mount.

---

## Special Topics

### Server-Sent Events (SSE)

SSE endpoints return `text/event-stream` with headers:

```
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

**Authentication:** Browsers' `EventSource` API cannot set `Authorization` headers. Pass the Supabase access token as a query parameter instead:

```
GET /chat_rooms/stream?access_token=<token>
GET /chat_rooms/{room_id}/stream?access_token=<token>
```

**Event format:** Redis pub/sub messages are forwarded as SSE `data:` lines containing JSON. Heartbeats are sent as `: heartbeat` comments. If Redis is disabled, an `event: error` with `data: redis_disabled` is emitted.

**Store scoping:** The room-list stream filters events to the authenticated store's `store_id`.

### File Uploads

`POST /chat_rooms/{room_id}/messages/upload_image` accepts `multipart/form-data`:

| Field | Type | Constraints |
|---|---|---|
| `file` | file | Max 5 MB; JPEG, PNG, GIF, or WebP |

Returns a public HTTPS URL suitable for LINE `ImageSendMessage`. Uploads go to Supabase Storage.

### CSV Export

`GET /orders/export.csv` uses the same filter parameters as `GET /orders` but returns all matching rows (no pagination). Response includes a UTF-8 BOM (`\ufeff`) for Excel compatibility.

### DOCX Export

`GET /orders/{order_id}.docx` renders a work-order document using the store's field visibility config. Placeholders in the template use catalog keys (e.g. `{{ customer_name }}`).

### Security Notes

The following endpoints currently **do not** require `get_current_store` authentication:

| Endpoint | Risk |
|---|---|
| `GET /orders/room/{room_id}` | Any caller with a `room_id` can list orders |
| `PATCH /orders/{order_id}` | Any caller with an `order_id` can update an order |
| `POST /orders/{order_id}/suggest-from-chat` | Any caller can trigger LLM preview |

These may be intentional for internal/bot use but should be reviewed before exposing the API publicly.

---

## Example Requests

### List orders (authenticated)

```bash
curl -s "http://localhost:8000/orders?page=1&page_size=20&status=in_progress" \
  -H "Authorization: Bearer <supabase_access_token>"
```

### Subscribe to chat room updates (SSE)

```bash
curl -N "http://localhost:8000/chat_rooms/stream?access_token=<supabase_access_token>"
```

### Send a staff message

```bash
curl -s -X POST "http://localhost:8000/chat_rooms/42/messages" \
  -H "Authorization: Bearer <supabase_access_token>" \
  -H "Content-Type: application/json" \
  -d '{"text": "Your bouquet will be ready at 2 PM."}'
```

### Upload a staff chat image

```bash
curl -s -X POST "http://localhost:8000/chat_rooms/42/messages/upload_image" \
  -H "Authorization: Bearer <supabase_access_token>" \
  -F "file=@photo.jpg"
```

### Export orders as CSV

```bash
curl -s "http://localhost:8000/orders/export.csv?status=completed" \
  -H "Authorization: Bearer <supabase_access_token>" \
  -o orders.csv
```

### Update order status

```bash
curl -s -X PATCH "http://localhost:8000/order/123/status" \
  -H "Authorization: Bearer <supabase_access_token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "CONFIRMED"}'
```
