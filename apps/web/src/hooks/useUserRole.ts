import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

export type UserRole =
  | "anonymous"
  | "manager"
  | "tenant"
  | "registered"
  | "removed_tenant"
  | "loading";

export function useUserRole(): UserRole {
  const session = useQuery(api.session.role);
  if (session === undefined) return "loading";
  return session.kind;
}
