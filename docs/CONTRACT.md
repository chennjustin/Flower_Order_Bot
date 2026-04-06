# Contract Freeze (No Behavior Change)

本文件用來「凍結」目前專案的**對外行為契約**，作為後續架構重構（Clean Architecture / 模組拆分）時的回歸基準。

## Backend API Endpoints (FastAPI)

### Health
- **GET** `/health`
  - **200**: `"OK"` (PlainTextResponse)

### LINE Webhook
- **POST** `/callback`
  - Header: `X-Line-Signature` 必填
  - **200**: `"OK"` (PlainTextResponse)
  - **400**: Missing signature / Invalid signature

### Orders / Drafts
- **GET** `/orders`
  - Response model: `Optional[List[OrderOut]]`

- **POST** `/order/{room_id}`
  - 從 `OrderDraft` 建立正式 `Order`
  - Response model: `list[str]`

- **PATCH** `/order/{room_id}`
  - 更新指定 room 的 order（目前 route 無 request body）
  - Response model: `bool`

- **DELETE** `/order/{order_id}`
  - 取消/刪除 order（實作上是狀態變更）
  - Response model: `bool`

- **GET** `/orderdraft/{room_id}`
  - Response model: `Optional[OrderDraftOut]`

- **PATCH** `/orderdraft/{room_id}`
  - Body: `OrderDraftUpdate`
  - Response model: `Optional[OrderDraftOut]`

### LLM Organize (Draft)
- **PATCH** `/organize_data/{room_id}`
  - 觸發一次「整理訂單草稿」(OpenAI)
  - Response model: `OrderDraftOut`
  - 若整理失敗或回覆空：**404** `{"detail": "No data found"}`

### Messages (Chat Rooms)
Base prefix: `/chat_rooms`

- **GET** `/chat_rooms`
  - Response model: `List[ChatRoomOut]`

- **GET** `/chat_rooms/{room_id}/messages?after={datetime?}`
  - Response model: `List[ChatMessageOut]`

- **POST** `/chat_rooms/{room_id}/messages`
  - Body: `ChatMessageBase`
  - Response model: `ChatMessageOut`

- **POST** `/chat_rooms/{room_id}/switch_mode`
  - Body: `ChatRoomStage`
  - Response model: `{"message": "success"}`

### Statistics
- **GET** `/stats`
  - Response model: `StatsOut`

### Payment Methods
- **GET** `/payment_methods`
  - Response model: `list[PaymentMethodBase]`

- **PATCH** `/payment_methods/{payment_method_id}`
  - Response model: `PaymentMethodBase`

- **GET** `/payment_methods/{payment_method_id}`
  - Response model: `PaymentMethodBase`
  - **404**: `{"detail": "Payment method not found"}`

### Export
- **GET** `/orders/{order_id}.docx`
  - 成功：回傳 `StreamingResponse`（docx）
  - 找不到：回傳 `{"error": "Order not found"}`

### Dev / Seed
- **GET** `/generate-fake-data?count={int=10}`
  - **200**: `"OK"` (PlainTextResponse)

## LINE Conversation Flow (Stages)

Stage enum: `ChatRoomStage`（實際 enum 定義在 `backend/app/enums/chat.py`）

### Global behavior
- 每次收到 LINE text message：
  - 確保存在 `User`、`ChatRoom`、`OrderDraft`
  - 寫入一筆 `ChatMessage(direction=INCOMING, processed=False)`
  - 若距離最後一則訊息超過 7 天：重置 `stage=WELCOME`、`bot_step=-1`

### WELCOME
- `bot_step == -1`：發出 confirm template「是否啟動智慧訂購流程」並記錄一則 bot outgoing 訊息，然後 `bot_step=0`
- 第二次回覆：
  - 若文字為 `啟動智慧訂購流程`：切到 `BOT_ACTIVE`，`bot_step=1`
  - 否則：切到 `WAITING_OWNER` 並 reply「已轉交客服人員」

### BOT_ACTIVE
- 依 `bot_step` 執行：1(預算) → 2(顏色) / 3(花材) → 4(收尾) → 結束後轉 `WAITING_OWNER`
- 若流程 handler 缺失：轉 `WAITING_OWNER`、`bot_step=-1`

### ORDER_CONFIRM
- 若訂單確認後又收到訊息：轉 `WAITING_OWNER`（人工回覆）

## LLM Draft Organize Behavior
- 讀取該 room 所有 `processed=False` 的 `ChatMessage` 組成 `combined_text`
- 用 `app/prompts/order_prompt.txt` 產生 prompt，呼叫 OpenAI `model="gpt-4.1"`, `temperature=0`
- 期望模型輸出「純 JSON」，用 `json.loads(...)` 解析後更新 `OrderDraft`
- 若 draft 缺必要欄位：會對顧客 LINE push 缺漏提醒，並記錄一則 outgoing bot 訊息（且 `processed=True` 以免再被 GPT 讀到）

