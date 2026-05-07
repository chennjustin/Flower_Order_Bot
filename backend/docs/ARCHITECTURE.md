# Backend Architecture

本文件定義目前後端分層與開發規範，目標是讓程式碼易讀、易維護、易擴充。

## 技術棧

- FastAPI（API 框架）
- SQLAlchemy 2.x + AsyncSession（ORM / 非同步 DB）
- Alembic（Migration）
- Pydantic（Schema 驗證）
- pytest（測試）

## 分層設計

資料流：

`Frontend -> API Route -> Service -> Repository -> Database`

### 1) API Route 層（`app/routes/`）

- 負責 HTTP 入口（path、method、status）
- 負責 request/response schema 對接
- 呼叫 service，不直接寫 SQL
- 不放複雜商業流程

### 2) Service 層（`app/services/`）

- 負責商業流程與規則判斷
- 協調多個 repository / 外部整合（例如 LINE）
- 不直接寫 `select()/delete()/update()`（盡量下沉到 repository）
- 可保留薄 service 作為一致入口（例如轉呼叫 usecase）

### 3) Repository 層（`app/repositories/`）

- 負責資料存取（SQLAlchemy 查詢與寫入）
- 對外提供可重用的 DB 操作函式
- 盡量不包含業務規則

### 4) Model 層（`app/models/`）

- ORM 資料表模型定義
- 只描述資料結構與關聯

### 5) Schema 層（`app/schemas/`）

- Pydantic 請求/回應資料模型
- 用於 API 邊界與資料驗證

### 6) Enum 層（`app/enums/`）

- 定義固定常數（狀態、模式、方向）
- 避免魔法字串散落在各層

### 7) Usecase 層（`app/usecases/`）

- 跨流程或較重的業務用例
- 由 service 呼叫，讓複雜流程集中

## 目前 API 聚合

- `app/main.py` 只掛一個 API 入口：`app.api.v1.router.api_router`
- `app/api/v1/router.py` 統一 include 既有 route 模組
- 對外 API 路徑維持不變（由 contract test 保護）

## 開發規範（新增功能）

1. 先定義/更新 schema（若需要）
2. 在 route 新增 endpoint（只做 HTTP 邊界）
3. 在 service 實作商業流程
4. 在 repository 新增 DB 操作
5. 補測試並跑 `contract-check`

## 測試守門

- 快速契約檢查：
  - `pytest backend/tests/test_openapi_contract.py`
- 基本 smoke：
  - `pytest backend/tests/test_health.py`
- 其他功能測試依模組補齊

