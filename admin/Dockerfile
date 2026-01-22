FROM node:20-alpine AS builder
WORKDIR /app

# Soporta build context en raíz del repo o en carpeta admin/
COPY . .
RUN if [ -d admin ]; then \
  cp admin/package*.json ./; \
  cp admin/next.config.* ./; \
  cp admin/tsconfig*.json ./; \
  cp admin/postcss.config.* ./; \
  cp admin/next-env.d.ts ./; \
  cp -r admin/src ./src; \
  cp -r admin/public ./public; \
fi

RUN npm ci
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
EXPOSE 3002

# Next standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER node
CMD ["node", "server.js"]
