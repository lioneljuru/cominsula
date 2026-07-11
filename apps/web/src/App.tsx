import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { ManagerLayout } from "@/components/layout/ManagerLayout";
import { TenantLayout } from "@/components/layout/TenantLayout";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RequireManager, RequireTenant } from "@/components/auth/RoleGate";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage, RegisterCompletePage } from "@/pages/auth/RegisterPage";
import { ForgotPasswordPage, CheckEmailPage, ResetPasswordPage, PasswordChangedPage } from "@/pages/auth/PasswordPages";
import { InviteLandingPage, InviteAcceptPage, InviteSuccessPage } from "@/pages/invite/InvitePages";
import { ManagerDashboardPage } from "@/pages/manager/DashboardPage";
import { PropertiesListPage } from "@/pages/manager/PropertiesListPage";
import { PropertyCreatePage } from "@/pages/manager/PropertyCreatePage";
import { PropertyDetailPage, PropertyEditPage } from "@/pages/manager/PropertyDetailPage";
import { TenantsListPage } from "@/pages/manager/TenantsListPage";
import { TenantCreatePage } from "@/pages/manager/TenantCreatePage";
import { TenantDetailPage, TenantEditPage } from "@/pages/manager/TenantDetailPage";
import { SubscriptionPage } from "@/pages/manager/SubscriptionPage";
import { SettingsPage } from "@/pages/manager/SettingsPage";
import { TenantDashboardPage } from "@/pages/tenant/TenantDashboardPage";
import { TenantChargesPage } from "@/pages/tenant/TenantChargesPage";
import { TenantNoticesPage } from "@/pages/tenant/TenantNoticesPage";
import { TenantScorePage } from "@/pages/tenant/TenantScorePage";
import { TenantAccountPage } from "@/pages/tenant/TenantAccountPage";
import { HomeRedirect, NotFoundPage, ForbiddenPage, ServerErrorPage, OfflinePage } from "@/pages/utility/UtilityPages";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />

        {/* Auth */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/check-email" element={<CheckEmailPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/password-changed" element={<PasswordChangedPage />} />
        </Route>
        <Route path="/register/complete" element={<RegisterCompletePage />} />

        {/* Invite (unauthenticated) */}
        <Route path="/invite/:token" element={<InviteLandingPage />} />
        <Route path="/invite/:token/accept" element={<InviteAcceptPage />} />
        <Route path="/invite/success" element={<InviteSuccessPage />} />

        {/* Manager app */}
        <Route element={<RequireAuth />}>
          <Route element={<RequireManager />}>
            <Route element={<ManagerLayout />}>
              <Route path="/manager" element={<ManagerDashboardPage />} />
              <Route path="/manager/properties" element={<PropertiesListPage />} />
              <Route path="/manager/properties/new" element={<PropertyCreatePage />} />
              <Route path="/manager/properties/:propertyId" element={<PropertyDetailPage />} />
              <Route path="/manager/properties/:propertyId/edit" element={<PropertyEditPage />} />
              <Route path="/manager/tenants" element={<TenantsListPage />} />
              <Route path="/manager/tenants/new" element={<TenantCreatePage />} />
              <Route path="/manager/tenants/:tenantId" element={<TenantDetailPage />} />
              <Route path="/manager/tenants/:tenantId/edit" element={<TenantEditPage />} />
              <Route path="/manager/subscription" element={<SubscriptionPage />} />
              <Route path="/manager/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          {/* Tenant portal */}
          <Route element={<RequireTenant />}>
            <Route element={<TenantLayout />}>
              <Route path="/tenant" element={<TenantDashboardPage />} />
              <Route path="/tenant/charges" element={<TenantChargesPage />} />
              <Route path="/tenant/notices" element={<TenantNoticesPage />} />
              <Route path="/tenant/score" element={<TenantScorePage />} />
              <Route path="/tenant/account" element={<TenantAccountPage />} />
            </Route>
          </Route>
        </Route>

        {/* Utility */}
        <Route path="/403" element={<ForbiddenPage />} />
        <Route path="/500" element={<ServerErrorPage />} />
        <Route path="/offline" element={<OfflinePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
