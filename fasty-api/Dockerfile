# ============================================================
# fasty-api — Production Dockerfile (multi-stage)
# ============================================================
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# nc (netcat) sudah built-in di busybox Alpine, tidak perlu install

# Copy SQL migration file & entrypoint script (sebagai root dulu)
COPY sql ./sql
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Non-root user
RUN addgroup -S app && adduser -S app -G app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# Ubah ownership ke app user
RUN chown -R app:app /app

EXPOSE 3000
ENTRYPOINT ["/app/entrypoint.sh"]
