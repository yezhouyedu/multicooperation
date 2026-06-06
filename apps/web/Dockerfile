FROM node:24-bookworm AS base

WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

COPY . .
ARG NEXT_PUBLIC_SERVER_BASE_URL=http://localhost:3001
ENV NEXT_PUBLIC_SERVER_BASE_URL=$NEXT_PUBLIC_SERVER_BASE_URL
RUN pnpm --filter web build

EXPOSE 3000
CMD ["corepack", "pnpm", "--filter", "web", "start"]
