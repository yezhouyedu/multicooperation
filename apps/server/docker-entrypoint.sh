#!/bin/sh
set -e

corepack pnpm --filter server exec prisma migrate deploy
corepack pnpm --filter server start:prod
