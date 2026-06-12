# 完整安裝與設定指南

## 系統需求

- Python 3.12+
- Node.js 22+
- Docker Desktop（選用，建議使用）
- Supabase 帳號（或自備 PostgreSQL + Redis）

---

## 方式 A：Docker Compose（建議）

```bash
git clone <repository-url>
cd Flower_Order_Bot

cp backend/.env.example backend/.env
# 編輯 backend/.env（至少填 DATABASE_URL、OPENAI_API_KEY、LINE 相關）

docker compose up --build   # 第一次
docker compose up           # 之後
```

服務位址：
- 前端：`http://localhost:5173`
- 後端 API / Swagger：`http://localhost:8000/docs`

---

## 方式 B：本機執行

```bash
# 後端
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
./venv/bin/alembic upgrade head
python -m uvicorn app.main:app --reload --port 8000

# 前端（另開終端機）
cd frontend
npm install
npm run dev
```

---

## 環境變數

```bash
cp backend/.env.example backend/.env
```

| 變數 | 說明 |
|------|------|
| `DATABASE_URL` | 非同步連線（`postgresql+asyncpg://user:pass@host/db`） |
| `DATABASE_ALEM_URL` | Alembic 用（`postgresql+psycopg2://user:pass@host/db`） |
| `REDIS_URL` | Redis 連線（`redis://localhost:6379`） |
| `OPENAI_API_KEY` | OpenAI API Key |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Bot Channel Access Token |
| `LINE_CHANNEL_SECRET` | LINE Bot Channel Secret（Webhook 簽章驗證） |
| `PUBLIC_BASE_URL` | 後端對外網址（本機：`http://localhost:8000`） |
| `SUPABASE_URL` | Supabase 專案 URL |
| `SUPABASE_ANON_KEY` | Supabase anon key（前端 / 後端驗證用） |

---

## 資料庫 Migration

```bash
cd backend
make migrate
# 或
./venv/bin/alembic upgrade head
```

若有多個 migration head：

```bash
./venv/bin/alembic merge heads -m "merge"
./venv/bin/alembic upgrade head
```

---

## 新增店家

每家花店對應一個 `store` 資料列，需有獨立的 LINE Bot channel。

```bash
cp backend/config/stores.provision.example.json backend/config/stores.provision.json
# 編輯 stores.provision.json
make provision-stores
```

`stores.provision.json` 範例：

```json
[
  {
    "name": "我的花店",
    "owner_email": "owner@example.com",
    "line_channel_access_token": "...",
    "line_channel_secret": "..."
  }
]
```

腳本執行後會：
1. 呼叫 LINE API 取得 Bot 的 `userId`（`store.line_bot_uid`）
2. 建立 `store` 資料列
3. 建立預設的 `store_order_field_config`
4. 店主用 `owner_email` 對應的 Google 帳號登入後台時自動綁定

---

## LINE Webhook 設定

### 本機開發（ngrok）

```bash
ngrok http 8000
```

在 [LINE Developers Console](https://developers.line.biz/) 將 Webhook URL 設為：

```
https://<ngrok-id>.ngrok.io/callback
```

並將 `backend/.env` 的 `PUBLIC_BASE_URL` 改為對應的 https 網址。

### 正式環境

將 `PUBLIC_BASE_URL` 設為正式網域，Webhook URL 設為 `https://your-domain.com/callback`。

---

## 測試資料

```bash
cd backend
source venv/bin/activate
PYTHONPATH=. python app/seeds/seed_all.py
```

---

## 測試

### 後端

```bash
cd backend
source venv/bin/activate

pytest                                              # 全部
pytest tests/test_store_context.py                 # 多租戶隔離
pytest tests/test_order_field_config_service.py    # 欄位設定
pytest tests/test_organize_order_draft_flow.py     # AI 整理草稿流程
pytest tests/test_order_draft_field_validation.py  # 草稿欄位驗證
```

### API 契約

```bash
cd backend
make contract-check
```

### 前端

```bash
cd frontend
npm run test
```
