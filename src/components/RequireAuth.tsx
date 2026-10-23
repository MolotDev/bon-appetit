import { Navigate, Outlet, useLocation } from "react-router-dom";
import { dictionary } from "@/constants/dictionary";
import { useAuthStore } from "@/stores/authStore";
import type { UserRole } from "@/types";

type RequireAuthProps = {
  role?: UserRole;
};

export function RequireAuth({ role }: RequireAuthProps) {
  const location = useLocation();
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const profile = useAuthStore((state) => state.profile);

  if (isInitializing) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted-foreground">
        {dictionary.common.loading}
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (profile.must_change_password && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  if (role && profile.role !== role) {
    return <Navigate to={profile.role === "ADMIN" ? "/admin/menu" : "/"} replace />;
  }

  return <Outlet />;
}
