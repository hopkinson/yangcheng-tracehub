FROM node:22-alpine AS base
WORKDIR /app
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories \
    && apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate \
    && pnpm config set registry https://registry.npmmirror.com

FROM base AS deps
COPY package.json pnpm-lock.yaml* .npmrc* ./
COPY prisma ./prisma/
RUN pnpm install --frozen-lockfile || pnpm install

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p /app/public
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories \
    && apk add --no-cache libc6-compat openssl
RUN npm config set registry https://registry.npmmirror.com \
    && npm install -g prisma@6.4.1 \
    && ln -sf /usr/local/bin/prisma /usr/bin/prisma

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 创建数据与持久化目录
RUN mkdir -p /app/data /app/public/uploads

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY scripts ./scripts
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh \
    && mkdir -p /app/node_modules/.bin \
    && ln -sf /usr/local/bin/prisma /app/node_modules/.bin/prisma

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
