import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthActions } from "@convex-dev/auth/react";
import { AUTH_UI_MESSAGES, getClientRateLimitKey } from "@/lib/authSecurity";

export function ForgotPasswordPage() {
  const { signIn } = useAuthActions();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setInfo("");
    try {
      await signIn("password", {
        email,
        flow: "reset",
        rateLimitKey: getClientRateLimitKey(),
      });
    } catch {
      // Expected — reset returns null / generic error; always show same copy.
    }
    setInfo(AUTH_UI_MESSAGES.passwordResetRequest);
    setLoading(false);
    // Proceed to code entry regardless of whether the email exists.
    navigate("/reset-password", { state: { email } });
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-900">Forgot password</h2>
      <p className="mt-2 text-sm text-slate-600">
        Enter your email and we will send a reset code if an account exists.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            maxLength={254}
          />
        </div>
        {info && <p className="text-sm text-slate-700">{info}</p>}
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Sending…" : "Send reset code"}
        </button>
      </form>
      <Link to="/login" className="mt-6 inline-block text-sm text-brand-600 hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}

export function CheckEmailPage() {
  return (
    <div className="text-center">
      <h2 className="text-xl font-semibold text-slate-900">Check your email</h2>
      <p className="mt-2 text-sm text-slate-600">{AUTH_UI_MESSAGES.passwordResetRequest}</p>
      <Link to="/login" className="mt-6 inline-block text-sm text-brand-600 hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}

export function ResetPasswordPage() {
  const { signIn } = useAuthActions();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn("password", {
        email,
        code,
        newPassword,
        flow: "reset-verification",
        rateLimitKey: getClientRateLimitKey(),
      });
      navigate("/password-changed");
    } catch {
      setError(AUTH_UI_MESSAGES.loginFailure);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-900">Reset password</h2>
      <p className="mt-2 text-sm text-slate-600">
        Enter the code from your email and choose a new password.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={254}
          />
        </div>
        <div>
          <label className="label" htmlFor="code">Reset code</label>
          <input
            id="code"
            className="input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            autoComplete="one-time-code"
            maxLength={32}
          />
        </div>
        <div>
          <label className="label" htmlFor="newPassword">New password</label>
          <input
            id="newPassword"
            type="password"
            className="input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
      <Link to="/login" className="mt-6 inline-block text-sm text-brand-600 hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}

export function PasswordChangedPage() {
  return (
    <div className="text-center">
      <h2 className="text-xl font-semibold text-slate-900">Password changed</h2>
      <p className="mt-2 text-sm text-slate-600">Your password has been updated successfully.</p>
      <Link to="/login" className="mt-6 inline-block btn-primary">
        Sign in
      </Link>
    </div>
  );
}
