import { Link } from "react-router-dom";

export function ForgotPasswordPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-900">Forgot password</h2>
      <p className="mt-2 text-sm text-slate-600">
        Password recovery requires an email provider configured in Convex Auth. Contact your administrator or use Convex dashboard to reset credentials during MVP.
      </p>
      <Link to="/login" className="mt-6 inline-block text-sm text-brand-600 hover:underline">Back to sign in</Link>
    </div>
  );
}

export function CheckEmailPage() {
  return (
    <div className="text-center">
      <h2 className="text-xl font-semibold text-slate-900">Check your email</h2>
      <p className="mt-2 text-sm text-slate-600">If password recovery is enabled, you will receive a reset link shortly.</p>
      <Link to="/login" className="mt-6 inline-block text-sm text-brand-600 hover:underline">Back to sign in</Link>
    </div>
  );
}

export function ResetPasswordPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-900">Reset password</h2>
      <p className="mt-2 text-sm text-slate-600">Password reset flow is configured via Convex Auth email provider.</p>
      <Link to="/login" className="mt-6 inline-block text-sm text-brand-600 hover:underline">Back to sign in</Link>
    </div>
  );
}

export function PasswordChangedPage() {
  return (
    <div className="text-center">
      <h2 className="text-xl font-semibold text-slate-900">Password changed</h2>
      <p className="mt-2 text-sm text-slate-600">Your password has been updated successfully.</p>
      <Link to="/login" className="mt-6 inline-block btn-primary">Sign in</Link>
    </div>
  );
}
