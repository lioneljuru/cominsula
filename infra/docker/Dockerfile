# Stage 1: build the SPA
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY packages/shared packages/shared
COPY apps/web apps/web
COPY convex/_generated convex/_generated

RUN pnpm install --frozen-lockfile
ARG VITE_CONVEX_URL
ENV VITE_CONVEX_URL=$VITE_CONVEX_URL
RUN pnpm --filter @cominsula/web build

# Stage 2: serve with Nginx (stateless — safe behind L7 LB)
FROM nginx:1.27-alpine
COPY infra/docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/health || exit 1
