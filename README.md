# ChiMei Floral



本專案為一個花店商家後台，透過 LINE Bot 將顧客訊息利用 OpenAI API 整理成格式化的訂單資訊（例如顧客姓名、聯絡電話、花材種類、數量、取貨時間及特殊需求）回傳給使用者。商家確認無誤後，資料將會被寫入訂單資料庫中，並可透過 `/orders` 頁面查詢所有訂單；目前 **CSV 匯出由前端在瀏覽器端直接產生下載**、DOCX 工單則由後端提供下載，協助商家省下人工抄寫與反覆確認的時間成本。



---



## ✅ 已實作功能



* ✅ 支援 LINE Bot 接收訊息、自動儲存使用者對話內容

* ✅ 使用 GPT 模型將對話轉換為結構化訂單（透過關鍵字觸發）

* ✅ 以 **PostgreSQL** 為主資料庫（本機開發常用 Docker 提供；部署環境自備或雲端託管）

* ✅ 管理訂單、顧客資料與歷史訊息

* ✅ 提供 `/orders` 頁面查詢訂單，並支援 CSV 匯出（前端產生下載）與 DOCX 工單匯出（後端下載）

* ✅ 前端以 Vue 框架實作，可即時查看與操作訂單系統

* ✅ 使用 Alembic 作資料庫版本控制



---



## 📁 目錄



* [系統需求](#系統需求)

* [安裝與設定](#安裝與設定)

* [環境變數設定](#環境變數設定)

* [資料庫與連線](#資料庫與連線)

* [執行應用程式](#執行應用程式)

* [Webhook 配置](#webhook-配置)

* [程式架構說明](#程式架構說明)

* [授權](#授權)



---



## ⚙️ 系統需求



* 作業系統：MacOS / Linux / Windows

* Python：3.8 以上（建議 3.12）

* Node.js：18+（前端執行需使用）

* **Docker Desktop**（建議）：用於本機 PostgreSQL 容器；亦可用於一鍵啟動前後端



---



## 🧰 安裝與設定



### 1. 複製專案



```bash

git clone <repository-url>

cd <repository-folder>

```



### 2. 建立虛擬環境（後端）



```bash

cd backend

python3 -m venv venv

source venv/bin/activate  # Windows 用 venv\Scripts\activate

pip install -r requirements.txt

```



### 3. 安裝前端依賴（Vue）



```bash

cd frontend

npm install

```



---



## 🔐 環境變數設定



在 `backend` 目錄建立 `.env`，可複製並修改 `backend/.env.example`。



若需 LINE Bot 與 OpenAI 功能，金鑰來源如下：



* [OpenAI Platform](https://platform.openai.com/account/api-keys)

* [LINE Developers Console](https://developers.line.biz/console/)



### 資料庫相關（`POSTGRES_*`）



後端會依 `POSTGRES_USER`、`POSTGRES_PASSWORD`、`POSTGRES_DB`、`POSTGRES_HOST`、`POSTGRES_PORT` 組出連線字串；若直接在 `.env` 設定 `DATABASE_URL` / `DATABASE_ALEM_URL`，則以該值為優先（見 `app/core/settings.py`）。



* **本機只跑 uvicorn**：通常 `POSTGRES_HOST=localhost`，`POSTGRES_PORT` 對應到 Docker 對外映射的埠（預設為 `5432`，見下方 [資料庫與連線](#資料庫與連線)）。

* **`docker compose` 跑 backend 容器**：Compose 會覆寫 `POSTGRES_HOST=db`，容器內固定連 compose 服務名，埠為容器內 `5432`。



---



## 資料庫與連線


本機若另外安裝了 **Windows 版 PostgreSQL**，常見服務名為 `postgresql-x64-17`，預設也會聽 **5432**。此時與 Docker 對外映射的 **5432** 會衝突或導致連線打到錯的實例（帳密不一致就會認證失敗）。


建議擇一：


1. **開發時只用 Docker 的 db**：以**系統管理員**開啟 PowerShell，停止本機服務並可改為手動啟動，避免下次開機又佔埠：



   ```powershell

   Stop-Service -Name "postgresql-x64-17" -Force

   Set-Service -Name "postgresql-x64-17" -StartupType Manual

   ```



2. **必須保留本機 PostgreSQL**：請自行調整本機服務埠號，或改 Docker `db` 的 `ports` 映射與 `backend/.env` 的 `POSTGRES_PORT`，使後端只連到目標那一顆。



### 資料存在哪裡？



`docker compose` 的 Postgres 資料在 **volume `db_data`**（專案內由 Compose 管理），與本機安裝的 PostgreSQL 資料目錄是兩套；只要連線 host／port 固定，就不會寫進兩個地方。



### 遷移／重設開發庫



```bash

docker compose down -v   # 會刪除 volume，資料清空，請謹慎使用

docker compose up -d db

```



---



## 🚀 執行應用程式



專案支援兩種常見用法：**本機分開跑（適合日常改程式）** 與 **Docker 一鍵跑（適合整包驗收或交作業展示）**。



### 模式 A：開發用（資料庫用 Docker，前後端本機跑）



1. 在專案根目錄啟動資料庫（並確認 [資料庫與連線](#資料庫與連線) 一節，避免 5432 被本機 Postgres 佔用）：



   ```bash

   docker compose up -d db

   ```



2. 套用 schema（在 `backend` 目錄、已啟用虛擬環境）：



   ```bash

   cd backend

   alembic upgrade head

   ```



3. 啟動後端（**務必在 `backend` 目錄**，否則找不到 `app` 模組）：



   ```bash

   python -m uvicorn app.main:app --reload --port 8000

   ```



4. 啟動前端：



   ```bash

   cd frontend

   npm run dev

   ```



5. 網址：



   * 前端：`http://localhost:5173`

   * 後端：`http://localhost:8000`（Swagger UI 在根路徑 `/`）

   * Postgres（由主機連進容器）：`localhost:5432`（預設帳號／密碼／資料庫名見 `backend/.env` 與 `docker-compose.yml` 的 `db` 服務）



修改過 `backend/.env` 後，請**重啟 uvicorn**，否則可能仍沿用舊連線設定。



#### 選用：寫入測試資料



```bash

cd backend

PYTHONPATH=. python app/seeds/seed_all.py

```



---



### 模式 B：Docker Compose 一鍵（db + backend + frontend）



> 需先安裝 [Docker Desktop](https://www.docker.com/products/docker-desktop/)（Windows／Mac）。



1. 備妥 `backend/.env`（可參考 `backend/.env.example`）。



2. 在專案根目錄：



   ```bash

   docker compose up --build

   ```



3. 服務位址：



   * 前端：`http://localhost:5173`

   * 後端：`http://localhost:8000`（Swagger UI 在 `/`）

   * Postgres：`localhost:5432`（對外埠；容器內 backend 使用服務名 `db`）



4. 關閉：



   ```bash

   docker compose down

   ```



5. 連資料一併刪除（volume）：



   ```bash

   docker compose down -v

   ```



---



### 本機對外暴露 Webhook（LINE）



可使用 [ngrok](https://ngrok.com) 將本機後端提供給 LINE Webhook：



```bash

ngrok http 8000

```



---



## 🔗 Webhook 配置



請至 [LINE Developers Console](https://developers.line.biz/console/) 設定 Webhook URL。本機除錯時請配合 ngrok 或同等隧道；正式環境則改為你的網域，例如：



```

https://your-domain.example.com/callback

```



---



## 🧠 程式架構說明



### `backend/app/` 後端（FastAPI）



* `main.py`：主應用與路由掛載

* `models/`：資料表定義（User、Order、Message、Shipment 等）

* `routes/`：API 路由模組（linebot、orders、health 等）

* `services`：實作各種資料庫 CRUD 功能

* `schemas/`：定義資料 Input 與 Output 格式

* `core/`：設定（含資料庫連線字串組裝）與共用依賴

* `seeds/`：測試／假資料產生程式



### `frontend/` 前端（Vue）



* Vue 專案：提供聊天室介面、訂單列表等操作頁面



---



## 📄 授權 License



本專案採用 [MIT License](LICENSE)，歡迎自由使用、修改與商業應用。

