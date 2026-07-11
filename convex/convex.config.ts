import { defineApp } from "convex/server";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";

/**
 * Convex app component wiring. The rate limiter is a first-class, transactional
 * component (no Redis needed) used to protect the anonymous invite-acceptance
 * endpoint, which is the system's real attack surface (PRD §6.7).
 */
const app = defineApp();
app.use(rateLimiter);

export default app;
