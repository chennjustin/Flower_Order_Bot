# Backend Architecture

本文件定義目前後端分層與開發規範，目標是讓程式碼易讀、易維護、易擴充。

## 技術棧

- Fastify（API 框架）
- Drizzle ORM + postgres.js（資料庫）
- Drizzle Kit（Migration）
- Zod（可選，邊界驗證）
- Vitest（測試）

## 分層設計

資料流：

`Frontend -> app.ts (routes) -> Service -> Repository -> Database`

### 1) HTTP 層（`src/app.ts`）

- 負責 HTTP 入口（path、method、status）
- 呼叫 service，不直接寫 SQL

### 2) Service 層（`src/services/`）

- 負責商業流程與規則判斷
- 協調 repository / 外部整合（LINE、OpenAI）

### 3) Repository 層（`src/db/repositories.ts`）

- 負責資料存取（Drizzle 查詢與寫入）

### 4) Schema 層（`src/db/schema.ts`）

- 資料表與關聯定義

### 5) Usecase 層（`src/usecases/`）

- LINE 對話流程、GPT 整理訂單草稿等跨模組流程

## 測試守門

- 契約檢查：`cd backend && npm run test -- tests/http_contract.test.ts`（需 Postgres）
- 單元：`cd backend && npm run test -- tests/parse_order_draft.test.ts`
