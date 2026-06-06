# ChiMei Floral

本專案為花店商家後台：透過 LINE Bot 接收顧客訊息，以 OpenAI 將對話整理成結構化訂單草稿；商家確認後寫入訂單資料庫，並在 `/orders` 查詢。CSV 由前端在瀏覽器產生下載，DOCX 工單由後端提供。

**目前分支（`refactor/db`）** 已改為 **多租戶 schema**（`store` → `customer` → `chat_room` / `order`），主資料庫建議使用 **Supabase PostgreSQL**；Docker Compose **不再**內建本機 Postgres 容器。

---

## ✅ 已實作功能

- ✅ LINE Bot 接收訊息、儲存對話與貼圖
- ✅ GPT 將對話轉為結構化訂單草稿（關鍵字觸發）
- ✅ **PostgreSQL**（開發／部署以 Supabase 或自備 Postgres 為主）
- ✅ 管理訂單、顧客（`customer`）與聊天紀錄
- ✅ `/orders` 查詢、CSV（前端）、DOCX 工單（後端）
- ✅ 前端 **React + TypeScript + Vite**
- ✅ **Alembic** 資料庫版本控制

---

## 📁 目錄

- [系統需求](#系統需求)
- [安裝與設定](#安裝與設定)
- [環境變數](#環境變數)
- [資料庫與店家（store）](#資料庫與店家store)
- [執行應用程式](#執行應用程式)
- [Webhook 配置](#webhook-配置)
- [API 契約守門](#api-契約守門)
- [程式架構](#程式架構)
- [授權](#授權)

---

## ⚙️ 系統需求

- 作業系統：macOS / Linux / Windows
- Python：3.12+（建議與 `backend/Dockerfile` 一致）
- Node.js：22+（Vite 8 需 20.19+ 或 22.12+）
- **Docker Desktop**（選用）：一鍵跑前後端容器；資料庫仍連 Supabase
- **Supabase**（或相容的 PostgreSQL）：專案連線字串寫在 `backend/.env`

---

## 🧰 安裝與設定

### 1. 複製專案

```bash
git clone <repository-url>
cd <repository-folder>
```

### 2. 後端虛擬環境

```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. 前端依賴

```bash
cd frontend
npm install
```

### 4. 環境變數

```bash
cp backend/.env.example backend/.env
```

編輯 `backend/.env`，至少設定：

| 變數 | 說明 |
|------|------|
| `DATABASE_URL` | 非同步連線（`postgresql+asyncpg://...`，Supabase 請用 `ssl=require`） |
| `DATABASE_ALEM_URL` | Alembic 用（session pooler `:5432`；程式會自動改為 transaction pooler `:6543`） |
| `DATABASE_ALEM_DIRECT_URL` | 選填；Alembic 最優先（`db.<ref>.supabase.co`；需網路可連 IPv6/IPv4） |
| `DATABASE_DIRECT_URL` | 選填；`make provision-stores` 最優先；否則同樣自動改 `:6543` |
| `OPENAI_API_KEY` | OpenAI |
| `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_CHANNEL_SECRET` | LINE Bot（開發 fallback；正式請寫入 `store` 表） |
| `PUBLIC_BASE_URL` | 對外可連的後端基底網址（本機 `http://localhost:8000`；ngrok 請改 https） |

連線組裝邏輯見 `backend/app/core/settings.py`（若已設 `DATABASE_URL` 則優先於舊版 `POSTGRES_*`）。

金鑰來源：[OpenAI](https://platform.openai.com/account/api-keys)、[LINE Developers](https://developers.line.biz/console/)。

---

## 資料庫與店家（store）

### Schema 與遷移

- 多租戶表：`store`、`customer`、`chat_room`、`chat_message`、`order`、`order_draft`、`payment`、`payment_method`、`notification` 等。
- 破壞性遷移 **`f4e8bb2a9031`** 會 DROP 舊表後重建，**僅適合新庫或願意清空資料時**執行。
- 套用遷移（**必須用 `backend/venv`**，不要用 conda `(base)` 的 `alembic`，在 macOS 上常會 `malloc: double free` 後 abort）：

```bash
cd backend
make migrate
# 或：./venv/bin/alembic upgrade head
```

- 若出現 `Can't locate revision identified by 'a9f3c2d1e4b7'`：Supabase 曾記錄此 revision；repo 已含 bridge 檔 `a9f3c2d1e4b7_supabase_bridge_revision.py`，pull 最新程式後再 `./venv/bin/alembic upgrade head` 即可。其他未知 revision 請查 `SELECT * FROM alembic_version;` 或用手動 SQL：[`backend/docs/manual_migration_f1a2b3c4d5e6.sql`](backend/docs/manual_migration_f1a2b3c4d5e6.sql).

- 若出現 **`EMAXCONNSESSION` / max clients reached**（Session pooler 連線滿了，常見於同時開著 Docker 後端、本機 uvicorn、多次 alembic）：
  1. 暫停多餘的 backend／docker compose，或到 Supabase Dashboard 稍後再試。
  2. 再執行 `make migrate` / `make provision-stores`：程式會自動把 session pooler **`:5432`** 改成 transaction pooler **`:6543`**（同一個 `*.pooler.supabase.com` host）。若本機可連直連，也可手動設 **`DATABASE_ALEM_DIRECT_URL`**（`db.<ref>.supabase.co`）。
  3. 或略過 alembic，在 SQL Editor 執行 [`backend/docs/manual_migration_f1a2b3c4d5e6.sql`](backend/docs/manual_migration_f1a2b3c4d5e6.sql)，然後 `UPDATE alembic_version SET version_num = 'f1a2b3c4d5e6';`

- Docker 啟動時預設 **`SKIP_ALEMBIC_ON_START=1`**（不自動跑 Alembic），請在 Supabase 上自行確認 revision 或手動執行上述指令。

### 多店家 LINE（`store.slug` = webhook `destination`）

每個 Official Account 對應一筆 `store`：

| 欄位 | 說明 |
|------|------|
| `slug` | 與 LINE webhook JSON 的 **`destination`** 相同（channel user id，如 `U4b…`） |
| `line_channel_access_token` | 該店 Messaging API token |
| `line_channel_secret` | Webhook 簽章用 secret |

所有 channel 的 Webhook URL 可相同：`https://<PUBLIC_BASE_URL>/callback`。後端依 `destination` 查 `store.slug` 決定店家與 token。

遷移後請執行 `alembic upgrade head`（revision `f1a2b3c4d5e6` 新增 LINE 欄位）。

後台 API（聊天室、訂單、付款方式等）僅回傳**登入店主**所綁定 `store` 的資料（`get_current_store`）。

開發／測試前資料庫**至少要有一筆 `store`**。若 webhook 的 `destination` 尚無對應 `slug`，且 `.env` 仍有 `LINE_CHANNEL_SECRET`，會暫時 fallback 到 `id` 最小的 store（方便遷移前測試）。

### 自動建立／更新店家（JSON → Supabase）

不必手動寫 SQL 或自己查 `destination`：腳本會用你提供的 **Channel access token** 呼叫 LINE `GET /v2/bot/info`，把回傳的 **`userId`** 寫入 `store.slug`（與 webhook `destination` 相同）。

#### 1. 準備 JSON（勿 commit 含 secret 的檔案）

```bash
cd backend
cp config/stores.provision.example.json config/stores.provision.json
```

編輯 [`backend/config/stores.provision.json`](backend/config/stores.provision.json)（此檔已 gitignore）：

```json
{
  "stores": [
    {
      "name": "奇美花店",
      "owner_email": "owner@gmail.com",
      "line_channel_access_token": "貼上 Messaging API Channel access token",
      "line_channel_secret": "貼上 Channel secret",
      "timezone": "Asia/Taipei",
      "active": true
    }
  ]
}
```

| 欄位 | 必填 | 說明 |
|------|------|------|
| `name` | 是 | 店名 |
| `owner_email` | 是 | 店主 Gmail（小寫）；**首次用此帳號登入後台**時會自動綁定該 store |
| `line_channel_access_token` | 是 | 用來寫入 DB，並向 LINE 查 bot `userId` → `slug` |
| `line_channel_secret` | 是 | Webhook 簽章驗證 |
| `slug` | 否 | 可省略；若填了必須與 token 查到的 `userId` 一致 |
| `timezone` / `active` | 否 | 預設 `Asia/Taipei` / `true` |

多家店：在 `"stores"` 陣列再加一個物件即可。

#### 2. 確認 `backend/.env` 的 `DATABASE_URL` 指向目標 Supabase

#### 3. 執行指令（請用 `backend/venv`）

先確認 schema 已 migrate：

```bash
cd backend
make migrate
```

**試跑**（只查 LINE、不寫入資料庫）：

```bash
PYTHONPATH=. ./venv/bin/python scripts/provision_stores.py \
  --file config/stores.provision.json \
  --dry-run
```

**寫入 Supabase**：

```bash
make provision-stores
```

或：

```bash
PYTHONPATH=. ./venv/bin/python scripts/provision_stores.py \
  --file config/stores.provision.json
```

#### 4. 腳本實際會做什麼

對 JSON 裡每一筆 store：

1. 用 `line_channel_access_token` 呼叫 LINE → 取得 `userId` 當 `slug`
2. 以 `owner_email`（或既有 `slug`）在 `store` 表 **新增或更新** 一列
3. 寫入 `line_channel_access_token`、`line_channel_secret`、`name` 等
4. **不會**建立 Supabase Auth 帳號；`owner_auth_user_id` 仍為空，直到店主用 `owner_email` 登入一次

終端機會印出例如：`created store id=2 slug=Uabc...` 或 `updated store id=1`。

#### 5. 之後

- LINE Developers：各 channel 的 Webhook URL 設為 `https://<PUBLIC_BASE_URL>/callback`（可相同）
- 店主用 **`owner_email`** 的 Google 登入後台 → 只看自己店的聊天與訂單

選用：更新 token 後再跑一次 `make provision-stores`；若要強制店主重新綁定，加上 `--reset-owner-binding`（會清掉 `owner_auth_user_id`）。

手動 SQL 仍可用：[`backend/docs/manual_migration_f1a2b3c4d5e6.sql`](backend/docs/manual_migration_f1a2b3c4d5e6.sql)。

### 測試資料

```bash
cd backend
PYTHONPATH=. python app/seeds/seed_all.py
```

或後端啟動後：`GET http://localhost:8000/generate-fake-data?count=10`（需 DB 內已有 store）。

### 舊版本機 Docker Postgres

若仍要連過去 compose 裡的 `db` 容器，請在 `.env` 取消註解 `POSTGRES_*` 並自行調整 `docker-compose`；**目前預設流程以 Supabase 為準**，根目錄 `docker-compose.yml` 已不含 `db` 服務。

---

## 🚀 執行應用程式

### 模式 A：本機跑前後端（連 Supabase）

1. 確認 `backend/.env` 的 `DATABASE_URL` / `DATABASE_ALEM_URL` 正確，且 Supabase 上 schema 與 Alembic head 一致。
2. 後端（**工作目錄必須是 `backend`**）：

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

3. 前端：

```bash
cd frontend
npm run dev
```

4. 網址：
   - 前端：`http://localhost:5173`
   - 後端 API / Swagger：`http://localhost:8000`

修改 `.env` 後請重啟 uvicorn。

### 模式 B：Docker Compose（backend + frontend）

```bash
# 專案根目錄；第一次或 Dockerfile 有變更
docker compose up --build

# 日常
docker compose up
```

- 資料庫：讀取 `backend/.env` 的 Supabase，**不會**啟動本機 Postgres。
- `backend`、`frontend` 掛載 volume，支援 `--reload` / Vite HMR。
- 關閉：`docker compose down`

服務位址與模式 A 相同（5173 / 8000）。

### 本機對外 Webhook（LINE）

```bash
ngrok http 8000
```

將 LINE Webhook 指到 `https://<ngrok-id>.ngrok.io/callback`（各 channel 可用同一 URL），並把 `PUBLIC_BASE_URL` 改成對應的 https 基底（圖片 URL 用）。記得把 webhook 的 `destination` 寫入該店的 `store.slug`。

---

## 🔗 Webhook 配置

於 [LINE Developers Console](https://developers.line.biz/console/) 設定 Webhook URL，例如：

```text
https://your-domain.example.com/callback
```

本機除錯請配合 ngrok；開發用重置指令可設 `LINE_TEST_RESET_PHRASE`（傳入完全相同文字會刪除該聊天室與顧客相關資料）。

---

## ✅ API 契約守門

重構期間以 `docs/CONTRACT.md` 為基線：

```bash
cd backend
make contract-check
```

可連測試庫時建議：

```bash
cd backend
pytest tests/test_contract_smoke.py
```

---

## 🧠 程式架構

### `backend/app/`（FastAPI）

| 目錄 | 說明 |
|------|------|
| `main.py` | 應用入口、CORS、靜態 uploads |
| `api/v1/` | API 路由聚合 |
| `models/` | ORM：`Store`、`Customer`、`ChatRoom`、`Order` 等 |
| `routes/` | HTTP 路由（linebot、orders、chat、payment…） |
| `services/` | 業務邏輯 |
| `repositories/` | 資料存取（含 `get_first_store_id`） |
| `schemas/` | Pydantic 請求／回應；`User` 為 `Customer` 的相容別名 |
| `core/` | 設定、DB session |
| `seeds/` | 假資料產生 |

### `frontend/`（React + TypeScript）

- Vite、TanStack Query、React Router（`/`、`/orders`、`/messages`、`/stats`）
- `frontend/.env`：`VITE_API_BASE_URL`（預設 `http://localhost:8000`）

### 重構後手動 smoke

- 首頁訂單表與統計可載入；刪除訂單後列表刷新。
- `Messages`：切換聊天室、送訊、右側草稿面板、「更新／建立工單」。
- DOCX 下載、CSV 瀏覽器下載。
- `docker compose up` 下 5173 / 8000 行為與本機模式一致。

---

## 📄 授權

[MIT License](LICENSE)
