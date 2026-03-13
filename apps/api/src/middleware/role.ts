import { Elysia } from "elysia";
import type { UserRole } from "@fivemtotal/shared";
import { authMiddleware } from "./auth";

/**
 * Role hierarchy for permission checks.
 * Higher index = more privilege.
 */
const ROLE_HIERARCHY: UserRole[] = ["user", "analyst", "admin"];

function hasRole(currentRole: UserRole, requiredRole: UserRole): boolean {
  const currentIdx = ROLE_HIERARCHY.indexOf(currentRole);
  const requiredIdx = ROLE_HIERARCHY.indexOf(requiredRole);
  return currentIdx >= requiredIdx;
}

/**
 * Factory that creates a role-checking middleware for a minimum required role.
 * Returns 401 if not authenticated, 403 if insufficient role.
 *
 * Chains after authMiddleware so auth context is available.
 */
export function requireRole(minimumRole: UserRole) {
  return new Elysia({ name: `role-${minimumRole}` })
    .use(authMiddleware)
    .derive({ as: "scoped" }, async ({ auth: authCtx, set }) => {
      const userId = authCtx?.userId ?? null;
      const role = authCtx?.role ?? "user";

      if (!userId) {
        set.status = 401;
        return { authorized: false };
      }

      if (!hasRole(role, minimumRole)) {
        set.status = 403;
        return { authorized: false };
      }

      return { authorized: true };
    });
}
