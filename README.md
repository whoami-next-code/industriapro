# IndustriaSP Monorepo

Este repositorio contiene:

- `backend/` API NestJS
- `frontend/` Web pública (Next.js)
- `admin/` Panel administrativo (Next.js)
- `mobile_app/` App Flutter (no se despliega en Railway)

## Despliegue en Railway (recomendado con Dockerfile)

Crea 3 servicios separados en Railway apuntando a este repo:

1. **Backend**
   - Root directory: `backend`
   - Dockerfile: `backend/Dockerfile`
   - Variables: ver `backend/.env.example`

2. **Frontend**
   - Root directory: `frontend`
   - Dockerfile: `frontend/Dockerfile`
   - Variables: ver `frontend/.env.example`

3. **Admin**
   - Root directory: `admin`
   - Dockerfile: `admin/Dockerfile`
   - Variables: ver `admin/.env.example`

Railway inyecta `PORT` automáticamente. Los Dockerfiles ya escuchan en `${PORT}`.

## Variables críticas

- Backend: base de datos (PostgreSQL) y llaves de Supabase/Stripe/Correo.
- Backend (eventos): `RABBITMQ_URL` o `RABBITMQ_HOST`/`RABBITMQ_PORT`/`RABBITMQ_USER`/`RABBITMQ_PASSWORD`.
- Frontend/Admin: `NEXT_PUBLIC_API_URL` apuntando a `https://<backend>/api`.
- Flutter (mobile_app): compilar con `--dart-define=API_BASE_URL=https://<backend>/api`.

## RabbitMQ en Railway

Agrega el servicio RabbitMQ desde el marketplace de Railway y vincúlalo al backend.
Railway inyecta `RABBITMQ_URL` automáticamente; el backend lo detecta en `getRabbitMQConfig()`.

## Notas

- Los archivos `.env` reales **no** se suben al repositorio.
- SQLite es solo para desarrollo local en `backend/`.
# industriapro
