# Zorem

Zorem es una app de **stories efímeros** en **rooms privadas** con código de 6 caracteres. Un creator crea una room, comparte el link/QR y los viewers entran sin cuenta.

## Estructura del monorepo

- `apps/web-next` - Frontend principal (Next.js)
- `services/api` - Backend (Express + TypeScript + PostgreSQL)
- `packages/shared` - Tipos/constantes compartidas

## Desarrollo local

Requisitos: **Node >= 20** y **PostgreSQL**.

### Backend (services/api)

1. `cd services/api`
2. Crea `services/api/.env` (no se versiona) con al menos:
   - `DATABASE_URL=...`
   - `JWT_SECRET=...`
   - `FRONTEND_URL=http://localhost:3001` (recomendado)
3. `npm install`
4. `npm run dev` (API en `http://localhost:3000`)

Docs: `services/api/README.md`

### Frontend (apps/web-next)

1. `cd apps/web-next`
2. `npm install`
3. (Opcional) `NEXT_PUBLIC_API_URL=http://localhost:3000`
4. `npm run dev -- -p 3001` (Web en `http://localhost:3001`)

## Tests

- Backend: `cd services/api && npm test`
- Guía: `services/api/tests/README_TEST.md`

