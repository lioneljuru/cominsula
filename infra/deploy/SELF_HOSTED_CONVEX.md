# Self-Hosted Convex Migration Path

Cominsula ships on **managed Convex** today. This document describes how to migrate the backend to **self-hosted Convex** behind your own L7 load balancer when you outgrow the managed tier or need data residency.

## Current architecture (managed)

```
Browser → CDN → L7 LB → Nginx (SPA containers) → Managed Convex Cloud
```

- **Frontend**: stateless Nginx containers, horizontally scaled, health-checked at `/health`.
- **Backend**: Convex managed deployment handles its own scaling, caching, and load balancing.
- **Auth**: Convex Auth (Password provider) — accounts live in your Convex `users` table.

## Target architecture (self-hosted)

```
Browser → CDN → L7 LB → Nginx (SPA) → Self-hosted Convex (Docker) → Persistent volume
```

## Steps

1. **Deploy self-hosted Convex** using the official Docker images and Compose configs from the Convex repository. Mount a persistent volume for the database directory.
2. **Point the SPA** at the self-hosted Convex URL via `VITE_CONVEX_URL` at build time.
3. **Run migrations** with the Convex CLI against the self-hosted backend: `npx convex deploy --url https://convex.internal`.
4. **Configure log streaming** from the self-hosted instance to your observability stack (same JSON log format as managed).

## Caveats (read before migrating)

| Area | Managed (now) | Self-hosted |
|------|---------------|-------------|
| Convex Auth | Supported | CLI self-hosted support for Convex Auth is still maturing — verify before migrating auth |
| Reactive cache | Built-in | Same engine, you operate it |
| Load balancing | Convex handles | You place Convex behind your L7 LB + health checks |
| Backups | Managed | You own snapshot/restore |

## Recommended hybrid path

1. Run managed Convex for MVP and early production.
2. Keep the SPA fully stateless and CDN-fronted (already done).
3. When migrating, stand up self-hosted Convex in parallel, replay seed data, switch `VITE_CONVEX_URL`, and cut over during a maintenance window.
4. If Convex Auth is not ready on self-hosted, interim options are Clerk or Auth0 with Convex JWT integration — both have first-class Convex docs.

## Observability on self-hosted

Wire Convex function logs (stdout JSON from `convex/lib/log.ts`) to:

- **Sentry** for `severity: critical` events (scoring + subscription enforcement failures)
- **Slack webhook** for 5xx-equivalent critical paths on `/payments`, `/score/recalculate`, and limit enforcement

Alert on any `critical_path_failure` event — these subsystems must fail loudly per PRD §10/§11.
