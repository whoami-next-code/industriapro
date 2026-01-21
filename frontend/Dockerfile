FROM node:20-bullseye-slim AS builder
WORKDIR /app

# Soporta build context en raíz del repo o en carpeta frontend/
COPY . .
RUN if [ -d frontend ]; then \
  cp frontend/package*.json ./; \
  cp frontend/next.config.* ./; \
  cp frontend/tsconfig*.json ./; \
  cp frontend/postcss.config.* ./; \
  cp frontend/tailwind.config.* ./; \
  cp frontend/next-env.d.ts ./; \
  cp -r frontend/src ./src; \
  cp -r frontend/public ./public; \
fi

ENV NEXT_DISABLE_TURBOPACK=1
RUN npm ci --legacy-peer-deps --include=optional
RUN npm run build

FROM node:20-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
EXPOSE 3000
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
USER node
CMD ["sh", "-c", "next start -p ${PORT:-3000}"]

