.PHONY: all install migrate run test contract-check

all: install migrate run

install:
	npm ci

migrate:
	npm run migrate

run:
	npm run dev

test:
	npm test

contract-check:
	npm run test -- tests/http_contract.test.ts
