# Multi-stage build for production
FROM node:20-alpine AS base
RUN npm install -g pnpm@9.15.0
WORKDIR /app

# Dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run typecheck
RUN pnpm run build -w @app/mini-app

# Production
FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/mini-app/dist ./apps/mini-app/dist
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig.json ./

EXPOSE 3001

CMD ["pnpm", "run", "dev:api"]