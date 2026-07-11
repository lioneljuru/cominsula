import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuthActions } from "@convex-dev/auth/react";

const nav = [
  { to: "/tenant", label: "Dashboard", end: true },
  { to: "/tenant/charges", label: "Charges & Payments" },
  { to: "/tenant/notices", label: "Notices" },
  { to: "/tenant/score", label: "Score" },
  { to: "/tenant/account", label: "Account" },
];

export function TenantLayout() {
  const { signOut } = useAuthActions();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            <span className="text-xl font-semibold text-brand-900">Cominsula Tenant Portal</span>
            <button type="button" className="btn-secondary text-sm" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
        <nav className="border-t border-slate-100 px-4 py-2 flex gap-2 overflow-x-auto max-w-5xl mx-auto">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${
                  isActive ? "bg-brand-50 text-brand-700" : "text-slate-600"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
