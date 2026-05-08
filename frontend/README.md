# Frontend (React + TypeScript)

React 19 + TypeScript + Vite 7 + Tailwind 4 + shadcn/ui base.

## Local development

```bash
npm install
npm run dev
```

The dev server runs on `http://localhost:5173` and reads `VITE_API_BASE_URL` from the environment (default `http://localhost:8000`). See [`.env.example`](./.env.example).

## Scripts

- `npm run dev` — start Vite dev server
- `npm run build` — type-check (`tsc -b`) then production build
- `npm run preview` — preview the production build
- `npm run lint` — run ESLint
- `npm run typecheck` — run TypeScript without emitting

## Docker

```bash
# from repo root
docker compose up --build frontend
```

The container uses `node:22-alpine` (Vite 7 needs Node 20.19+ or 22.12+).
