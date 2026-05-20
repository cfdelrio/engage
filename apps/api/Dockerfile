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
RUN pnpm install --frozen-lockfile --prod=false 2>&1

FROM base AS builder
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY apps/api ./apps/api
COPY --from=deps /app/node_modules ./node_modules
RUN pnpm --filter @engage/database exec prisma generate
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
CMD ["node", "apps/api/dist/index.js"]
