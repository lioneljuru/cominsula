import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { api } from "./_generated/api";

/**
 * HTTP surface. Convex Auth mounts its own routes; we additionally expose the
 * anonymous invite lookup as a real HTTP endpoint (§7.10) so a shared invite
 * link resolves without the SPA. The SPA itself calls `api.invites.lookup`
 * directly (an anonymous Convex query), and completes acceptance via the
 * standard sign-up flow + `api.invites.link`.
 */
const http = httpRouter();

auth.addHttpRoutes(http);

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

http.route({
  pathPrefix: "/invites/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const token = url.pathname.replace(/^\/invites\//, "").replace(/\/+$/, "");
    if (!token) {
      return Response.json(
        { error: "Invite expired or already used" },
        { status: 410, headers: CORS_HEADERS },
      );
    }
    try {
      const result = await ctx.runQuery(api.invites.lookup, { token });
      if (!result) {
        return Response.json(
          { error: "Invite expired or already used" },
          { status: 410, headers: CORS_HEADERS },
        );
      }
      return Response.json(result, { headers: CORS_HEADERS });
    } catch {
      // Generic error for both expired and already-used (no enumeration).
      return Response.json(
        { error: "Invite expired or already used" },
        { status: 410, headers: CORS_HEADERS },
      );
    }
  }),
});

http.route({
  pathPrefix: "/invites/",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { headers: CORS_HEADERS })),
});

export default http;
