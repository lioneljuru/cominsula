/**
 * Convex Auth provider configuration. The deployment's own URL is the issuer
 * for the JWTs Convex Auth mints; no external identity provider is used
 * (email/password only, PRD §10).
 */
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
