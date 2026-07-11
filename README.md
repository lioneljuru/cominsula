# Cominsula.io

Tenant reliability & property management MVP — Convex backend + Vite/React SPA.

## Stack

- **Backend**: Convex (queries/mutations/actions), Convex Auth, `@convex-dev/rate-limiter`
- **Frontend**: Vite + React + TypeScript + Tailwind (Century Gothic)
- **Security**: Declarative RLS via `convex-helpers`, auth gates, append-only financial records
- **Deploy**: Docker + Nginx behind L7 LB; CDN for static assets

## Quick start

```bash
pnpm install
npx convex dev          # creates deployment, writes CONVEX_URL
# Copy deployment URL to apps/web/.env.local as VITE_CONVEX_URL=
pnpm dev                # Convex + Vite in parallel
```

Seed demo data:

```bash
pnpm seed
```

Run tests:

```bash
pnpm test
pnpm test:coverage
```

## Project layout

| Path | Purpose |
|------|---------|
| `convex/` | Schema, business logic, RLS, scoring engine |
| `apps/web/` | Manager + tenant SPA |
| `packages/shared/` | Shared types and scoring constants |
| `infra/` | Docker, Nginx, K8s manifests, migration docs |

## Key invariants (PRD v3)

- `managerId` immutable on tenants; cross-manager assignment rejected
- Charges + partial payment installments; lateness scored on completion date
- Append-only score snapshots and notices
- GET queries never write; stale scores computed ephemerally
- Subscription limits enforced in serializable mutations

## Deployment

Build and run the SPA container:

```bash
docker compose -f infra/deploy/docker-compose.yml build \
  --build-arg VITE_CONVEX_URL=https://your-deployment.convex.cloud
docker compose -f infra/deploy/docker-compose.yml up
```

Kubernetes: apply `infra/deploy/k8s/web-deployment.yaml` (3 replicas + HPA).

See [infra/deploy/SELF_HOSTED_CONVEX.md](infra/deploy/SELF_HOSTED_CONVEX.md) for the managed → self-hosted Convex migration path.
