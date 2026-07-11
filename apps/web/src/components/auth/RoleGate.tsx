import { Navigate, Outlet } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { Skeleton } from "@/components/ui/Skeleton";

export function RequireManager() {
  const role = useUserRole();
  if (role === "loading") {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }
  if (role === "tenant") return <Navigate to="/tenant" replace />;
  if (role === "registered") return <Navigate to="/register/complete" replace />;
  if (role === "removed_tenant") return <Navigate to="/403" replace />;
  if (role === "anonymous") return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function RequireTenant() {
  const role = useUserRole();
  if (role === "loading") {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }
  if (role === "manager") return <Navigate to="/manager" replace />;
  if (role === "removed_tenant") return <Navigate to="/403" replace />;
  if (role === "anonymous") return <Navigate to="/login" replace />;
  if (role === "registered") return <Navigate to="/login" replace />;
  return <Outlet />;
}
