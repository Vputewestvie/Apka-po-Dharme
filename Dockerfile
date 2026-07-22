FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache curl

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/bot/package.json apps/bot/package.json
COPY apps/mini-app/package.json apps/mini-app/package.json
COPY packages/ai-adapter/package.json packages/ai-adapter/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run typecheck
RUN npm run build -w @app/mini-app

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3001
ENV APP_DATABASE_PATH=/app/data/app.sqlite
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/mini-app/dist ./apps/mini-app/dist
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/apps/bot ./apps/bot
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/tsconfig.json ./

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 CMD curl -f "http://localhost:${PORT}/health" || exit 1

CMD ["npm", "run", "start:api"]
