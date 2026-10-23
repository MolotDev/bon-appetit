import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { PushOptInBanner } from "@/components/shared/PushOptInBanner";
import { Button } from "@/components/ui/button";
import { dictionary } from "@/constants/dictionary";
import { syncGrantedPushSubscription } from "@/services/push";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/utils/cn";

type AppShellProps = {
  links: Array<{ to: string; label: string }>;
  navPosition?: "top" | "bottom";
  showPushBanner?: boolean;
  wide?: boolean;
};

export function AppShell({
  links,
  navPosition = "top",
  showPushBanner = false,
  wide = false,
}: AppShellProps) {
  const profile = useAuthStore((state) => state.profile);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    if (!profile || profile.must_change_password) {
      return;
    }
    void syncGrantedPushSubscription(profile.id).catch(() => undefined);
  }, [profile]);

  const nav = (
    <nav
      className={cn(
        "flex gap-1 border-border bg-card",
        navPosition === "bottom"
          ? "fixed inset-x-0 bottom-0 z-20 mx-auto max-w-3xl border-t px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2"
          : "overflow-x-auto border-b px-2 py-2",
      )}
    >
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            cn(
              "flex min-h-11 flex-1 items-center justify-center rounded-md px-3 py-2 text-sm font-medium active:opacity-70",
              isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent",
            )
          }
          end={link.to === "/" || link.to === "/admin/menu"}
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className={cn("mx-auto flex min-h-dvh w-full flex-col", wide ? "max-w-6xl" : "max-w-3xl")}>
      <header className="flex items-center justify-between gap-3 border-b bg-card px-4 py-3">
        <div>
          <p className="text-sm font-semibold">{dictionary.appName}</p>
          <p className="text-xs text-muted-foreground">{profile?.full_name}</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-11" onClick={() => void logout()}>
          {dictionary.common.logout}
        </Button>
      </header>
      {navPosition === "top" ? nav : null}
      <div
        className={cn(
          "flex flex-1 flex-col gap-3 p-4",
          navPosition === "bottom" && "pb-[calc(5.5rem+env(safe-area-inset-bottom))]",
        )}
      >
        {showPushBanner && profile ? <PushOptInBanner userId={profile.id} /> : null}
        <Outlet />
      </div>
      {navPosition === "bottom" ? nav : null}
    </div>
  );
}
