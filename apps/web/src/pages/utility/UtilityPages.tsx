import { Link, Navigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl font-semibold text-slate-900">404</h1>
      <p className="mt-2 text-slate-600">Page not found.</p>
      <Link to="/" className="btn-primary mt-6">Go home</Link>
    </div>
  );
}

export function ForbiddenPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl font-semibold text-slate-900">403</h1>
      <p className="mt-2 text-slate-600">You don't have permission to access this resource.</p>
      <Link to="/login" className="btn-primary mt-6">Sign in</Link>
    </div>
  );
}

export function ServerErrorPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl font-semibold text-slate-900">500</h1>
      <p className="mt-2 text-slate-600">Something went wrong. Please try again later.</p>
      <button type="button" className="btn-primary mt-6" onClick={() => window.location.reload()}>Retry</button>
    </div>
  );
}

export function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">You're offline</h1>
      <p className="mt-2 text-slate-600">Check your connection and try again.</p>
    </div>
  );
}

export function HomeRedirect() {
  const role = useUserRole();
  if (role === "loading") return null;
  if (role === "manager") return <Navigate to="/manager" replace />;
  if (role === "tenant") return <Navigate to="/tenant" replace />;
  if (role === "registered") return <Navigate to="/register/complete" replace />;
  return <Navigate to="/login" replace />;
}
