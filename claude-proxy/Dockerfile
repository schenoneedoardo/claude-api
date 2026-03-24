# Stage 1: Build
FROM node:20-slim AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src/ ./src/

RUN pnpm build

# Stage 2: Runtime
FROM node:20-slim

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist

# Claude Code CLI must be available in the container
# Mount credentials: -v ~/.claude:/home/node/.claude:ro

ENV NODE_ENV=production
ENV PORT=3456
ENV HOST=0.0.0.0

EXPOSE 3456

USER node

CMD ["node", "dist/index.js"]
