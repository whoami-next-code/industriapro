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

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_API_BASE
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE

ENV NEXT_DISABLE_TURBOPACK=1
RUN npm ci --legacy-peer-deps --include=optional \
  && npm install lightningcss-linux-x64-gnu @tailwindcss/oxide-linux-x64-gnu --no-save --legacy-peer-deps
RUN npm run build

FROM node:20-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

# Next standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Crear directorio de caché con permisos correctos ANTES de cambiar a usuario node
RUN mkdir -p /app/.next/cache && \
    chmod -R 777 /app/.next && \
    chown -R node:node /app/.next && \
    chown -R node:node /app

USER node

# Crear script de inicio que asegura permisos del caché
RUN echo '#!/bin/sh\nmkdir -p /app/.next/cache\nchmod -R 777 /app/.next/cache 2>/dev/null || true\nexec node server.js' > /app/start.sh && chmod +x /app/start.sh

CMD ["/app/start.sh"]

