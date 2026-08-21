FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS dependencies
COPY package.json pnpm-lock.yaml* .npmrc* ./
COPY prisma ./prisma/
RUN pnpm install --frozen-lockfile || pnpm install
RUN npx prisma generate

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

COPY --from=builder /app ./

CMD ["sh", "-c", "npx prisma db push && npx tsx prisma/seed.ts && pnpm start"]
