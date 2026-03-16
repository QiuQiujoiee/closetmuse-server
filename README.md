# ClosetMuse Backend (Express + PostgreSQL + Prisma + Cookie/Session)

This backend supports:
- cookie/session auth (register/login/logout/me)
- image upload (authenticated, local disk)
- items CRUD (per-user)
- outfits create/list (per-user, with `isPublic`)
- explore public outfits (paginated)
- interactions on public outfits: like / favorite / comment
- explore returns `itemsPreview` (item image + name) for each outfit card

## Requirements
- Node.js 18+
- Docker Desktop (for local PostgreSQL)
- npm

## 1) Start PostgreSQL (local)
```bash
docker compose up -d
```

## 2) Install deps
```bash
npm install
cp .env.example .env
```

## 3) Create tables (Prisma migrate)
```bash
npx prisma migrate dev --name init
npx prisma generate
```

(Optional) open DB UI:
```bash
npx prisma studio
```

## 4) Run API
```bash
npm run dev
```

API base: http://localhost:3000/api

## Vite proxy (recommended)
Frontend `.env`:
```
VITE_API_URL=/api
```
`vite.config.ts`:
```ts
server: {
  proxy: {
    "/api": { target: "http://localhost:3000", changeOrigin: true },
    "/uploads": { target: "http://localhost:3000", changeOrigin: true },
  }
}
```

## Notes
- Session is stored in PostgreSQL (so login survives backend restarts).
- Existing lowdb files remain in the repo but are no longer used.
