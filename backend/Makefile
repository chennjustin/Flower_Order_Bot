# Makefile

# 標記這些目標為 phony，不對應到實際檔案
.PHONY: all install migrate provision-stores run test contract-check

# 預設目標：依序執行 install → migrate → run
all: install migrate run

PYTHON ?= ./venv/bin/python
ALEMBIC ?= ./venv/bin/alembic
export PYTHONPATH := .

# 安裝相依套件（請用 backend/venv，勿用 conda base 跑 alembic，易觸發 macOS double free）
install:
	$(PYTHON) -m pip install -r requirements.txt

# 執行 Alembic 資料庫遷移
migrate:
	$(ALEMBIC) upgrade head

# 從 config/stores.provision.json 建立／更新 store（含 LINE slug 自動查詢）
provision-stores:
	$(PYTHON) scripts/provision_stores.py --file config/stores.provision.json

# 啟動 Uvicorn 開發伺服器
run:
	$(PYTHON) -m uvicorn app.main:app --reload

# 執行後端測試
test:
	$(PYTHON) -m pytest tests

# 契約守門測試（不依賴資料庫）
contract-check:
	$(PYTHON) -m pytest tests/test_openapi_contract.py
