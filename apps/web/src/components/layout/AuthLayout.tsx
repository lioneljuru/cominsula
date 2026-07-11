import { Outlet } from "react-router-dom";

export function AuthLayout() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold text-brand-900">Cominsula.io</h1>
        <p className="mt-2 text-sm text-slate-600">Tenant reliability & property management</p>
      </div>
      <div className="card w-full max-w-md p-8">
        <Outlet />
      </div>
    </div>
  );
}
