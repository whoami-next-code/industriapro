FROM node:20-alpine AS builder
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

RUN npm ci
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
EXPOSE 3000
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
USER node
CMD ["sh", "-c", "next start -p ${PORT:-3000}"]

