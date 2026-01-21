FROM node:20-alpine AS builder
WORKDIR /app

# Soporta build context en raíz del repo o en carpeta backend/
COPY . .
RUN if [ -d backend ]; then \
  cp backend/package*.json ./; \
  [ -f backend/nest-cli.json ] && cp backend/nest-cli.json ./ || true; \
  [ -e backend/tsconfig.json ] && cp backend/tsconfig*.json ./ || true; \
  [ -d backend/src ] && cp -r backend/src ./src || true; \
  [ -d backend/public ] && cp -r backend/public ./public || true; \
fi

RUN npm ci
RUN npm run build

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