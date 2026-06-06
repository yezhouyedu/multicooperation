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
RUN pnpm --filter server prisma:generate
RUN pnpm --filter server build
RUN chmod +x apps/server/docker-entrypoint.sh

EXPOSE 3001
CMD ["apps/server/docker-entrypoint.sh"]
