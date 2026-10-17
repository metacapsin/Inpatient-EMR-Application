# Inpatient EMR Application

React + Vite frontend (this folder) with an Express + PostgreSQL backend in [`backend/`](backend/README.md).

```bash
npm run install:all          # frontend + backend dependencies
cp backend/.env.example backend/.env   # set secrets
npm run dev:all              # embedded PostgreSQL + API on :4000 + Vite on :5173
npm run db:setup             # (second terminal, once) migrations + demo data
```

Frontend → backend wiring is configured through `frontend/.env.local` (see `.env.example` and `backend/README.md`).
Database setup, migrations, seed data, API reference and tests are documented in [`backend/README.md`](backend/README.md).
