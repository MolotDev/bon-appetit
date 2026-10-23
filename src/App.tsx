import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { dictionary } from "@/constants/dictionary";
import { ForceChangePasswordView } from "@/features/auth/ForceChangePasswordView";
import { LoginView } from "@/features/auth/LoginView";
import { MenuPanelView } from "@/features/admin/MenuPanelView";
import { ReportsView } from "@/features/admin/ReportsView";
import { UsersPanelView } from "@/features/admin/UsersPanelView";
import { HistoryView } from "@/features/orders/HistoryView";
import { OrderView } from "@/features/orders/OrderView";
import { useAuthStore } from "@/stores/authStore";

const userLinks = [
  { to: "/", label: dictionary.nav.order },
  { to: "/history", label: dictionary.nav.history },
];

const adminLinks = [
  { to: "/admin/menu", label: dictionary.nav.menu },
  { to: "/admin/users", label: dictionary.nav.users },
  { to: "/admin/reports", label: dictionary.nav.reports },
];

export function App() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginView />} />
          <Route element={<RequireAuth />}>
            <Route path="/change-password" element={<ForceChangePasswordView />} />
          </Route>
          <Route element={<RequireAuth role="USER" />}>
            <Route element={<AppShell links={userLinks} navPosition="bottom" showPushBanner />}>
              <Route path="/" element={<OrderView />} />
              <Route path="/history" element={<HistoryView />} />
            </Route>
          </Route>
          <Route element={<RequireAuth role="ADMIN" />}>
            <Route element={<AppShell links={adminLinks} wide />}>
              <Route path="/admin/menu" element={<MenuPanelView />} />
              <Route path="/admin/users" element={<UsersPanelView />} />
              <Route path="/admin/reports" element={<ReportsView />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-center" />
    </>
  );
}
