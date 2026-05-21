FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/core/package.json packages/core/
COPY packages/database/package.json packages/database/
COPY packages/event-bus/package.json packages/event-bus/
COPY packages/rules-engine/package.json packages/rules-engine/
COPY packages/ai/package.json packages/ai/
COPY packages/channels/package.json packages/channels/
COPY packages/analytics/package.json packages/analytics/
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --prod=false 2>&1

FROM base AS builder
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY packages ./packages
COPY apps/api ./apps/api
RUN packages/database/node_modules/.bin/prisma generate --schema packages/database/prisma/schema.prisma
RUN pnpm --filter @engage/core build
RUN pnpm --filter @engage/database build
RUN pnpm --filter @engage/event-bus build
RUN pnpm --filter @engage/rules-engine build
RUN pnpm --filter @engage/ai build
RUN pnpm --filter @engage/channels build
RUN pnpm --filter @engage/analytics build
RUN pnpm --filter @engage/api build

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S engage -u 1001
COPY --from=builder --chown=engage:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=engage:nodejs /app/packages ./packages
COPY --from=builder --chown=engage:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=engage:nodejs /app/apps/api/package.json ./apps/api/
USER engage
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1
CMD ["node", "apps/api/dist/index.js"]
