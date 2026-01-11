# Zorem API (`services/api`)

Backend de Zorem (Express + TypeScript) con PostgreSQL.

## Requisitos

- Node >= 20
- PostgreSQL

## Variables de entorno

Crea `services/api/.env` (desarrollo) o configura variables en tu entorno.

Requeridas:
- `DATABASE_URL`
- `JWT_SECRET`

Recomendadas:
- `FRONTEND_URL` (para links/QR y CORS)
- `CORS_ORIGIN` (si no, usa `FRONTEND_URL`)
- `NODE_ENV` (`development`/`production`/`test`)

Opcionales (storage S3/R2):
- `STORAGE_TYPE`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME`
- `R2_ACCOUNT_ID`, `R2_ENDPOINT` (si usas R2)

Opcionales (email en producción):
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`

## Desarrollo

```bash
cd services/api
npm install
npm run dev
```

## Build / Start

```bash
cd services/api
npm run build
npm start
```

## Migraciones

SQL en `services/api/src/db/migrations/*.sql` (ejecutar en orden en tu DB).

## Tests

Ver `services/api/tests/README_TEST.md`.

