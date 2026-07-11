import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../../../../convex/_generated/api";
import { Skeleton } from "@/components/ui/Skeleton";

export function InviteLandingPage() {
  const { token } = useParams<{ token: string }>();
  const invite = useQuery(api.invites.lookup, token ? { token } : "skip");

  if (!token) {
    return <InviteErrorPage message="Invalid invite link." />;
  }
  if (invite === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-8 w-64" />
      </div>
    );
  }
  if (invite === null) {
    return <InviteErrorPage />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="card w-full max-w-md p-8 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">You're invited</h1>
        <p className="mt-4 text-slate-600">
          <span className="font-medium text-slate-900">{invite.tenantName}</span>, you've been invited to join{" "}
          <span className="font-medium">{invite.propertyName ?? "your property"}</span>
          {invite.unitLabel ? ` (${invite.unitLabel})` : ""}.
        </p>
        <Link to={`/invite/${token}/accept`} className="btn-primary mt-6 inline-block w-full">
          Set password & continue
        </Link>
      </div>
    </div>
  );
}

export function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const invite = useQuery(api.invites.lookup, token ? { token } : "skip");
  const linkInvite = useMutation(api.invites.link);
  const { signIn } = useAuthActions();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!token) return <InviteErrorPage />;
  if (invite === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-8 w-64" />
      </div>
    );
  }
  if (invite === null) return <InviteErrorPage />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn("password", {
        email: invite.tenantEmail,
        password,
        flow: "signUp",
      });
      await linkInvite({ token });
      navigate("/invite/success");
    } catch {
      setError("Could not accept invite. The link may have expired or already been used.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-xl font-semibold">Set your password</h1>
        <p className="mt-2 text-sm text-slate-600">Creating account for {invite.tenantEmail}</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Creating account…" : "Set password & continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function InviteSuccessPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Account created</h1>
        <p className="mt-2 text-sm text-slate-600">Welcome to Cominsula. You can now view your rent status and reliability score.</p>
        <button type="button" className="btn-primary mt-6 w-full" onClick={() => navigate("/tenant")}>
          Go to tenant dashboard
        </button>
      </div>
    </div>
  );
}

export function InviteErrorPage({ message = "Invite expired or already used" }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold text-slate-900">{message}</h1>
        <p className="mt-2 text-sm text-slate-600">Please contact your property manager for a new invite link.</p>
        <Link to="/login" className="mt-6 inline-block text-sm text-brand-600 hover:underline">Sign in</Link>
      </div>
    </div>
  );
}
