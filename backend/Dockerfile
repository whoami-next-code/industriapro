FROM node:20-alpine AS builder
WORKDIR /app

# Soporta build context en raíz del repo o en carpeta backend/
COPY . .
RUN set -e; \
  if [ -f backend/package.json ]; then \
    cd backend; \
    npm ci; \
    npm run build; \
    test -d dist; \
    cd /app; \
    cp backend/package*.json ./; \
    cp -r backend/dist ./dist; \
    [ -d backend/public ] && cp -r backend/public ./public || true; \
  elif [ -f package.json ] && [ -f nest-cli.json ]; then \
    npm ci; \
    npm run build; \
    test -d dist; \
  else \
    echo "No se encontro el paquete del backend en el contexto de build" && exit 1; \
  fi

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
EXPOSE 3001

COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

USER node
CMD ["node", "dist/src/main.js"]