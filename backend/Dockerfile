FROM node:20-alpine AS builder
WORKDIR /app

# Soporta build context en raíz del repo o en carpeta backend/
COPY . .
RUN set -e; \
  if [ -d backend ]; then \
    cd backend; \
    npm ci; \
    npm run build; \
    test -d dist; \
    cd /app; \
    cp backend/package*.json ./; \
    cp -r backend/dist ./dist; \
    [ -d backend/public ] && cp -r backend/public ./public || true; \
  else \
    npm ci; \
    npm run build; \
    test -d dist; \
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