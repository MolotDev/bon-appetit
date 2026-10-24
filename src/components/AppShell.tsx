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
  navPosition?: "top" | "bottom" | "sidebar";
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

  const isSidebar = navPosition === "sidebar";

  function navItems(compact: boolean) {
    return links.map((link) => (
      <NavLink
        key={link.to}
        to={link.to}
        className={({ isActive }) =>
          cn(
            "flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium active:opacity-70",
            compact ? "justify-start" : "flex-1 justify-center",
            isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent",
          )
        }
        end={link.to === "/"}
      >
        {link.label}
      </NavLink>
    ));
  }

  const logoutButton = (
    <Button type="button" variant="outline" size="sm" className="h-11" onClick={() => void logout()}>
      {dictionary.common.logout}
    </Button>
  );

  if (isSidebar) {
    return (
      <div className="flex min-h-dvh w-full">
        <aside className="hidden w-56 shrink-0 flex-col border-r bg-card print:hidden md:flex">
          <div className="border-b px-4 py-4">
            <p className="text-sm font-semibold">{dictionary.appName}</p>
            <p className="text-xs text-muted-foreground">{profile?.full_name}</p>
          </div>
          <nav className="flex flex-1 flex-col gap-1 p-2">{navItems(true)}</nav>
          <div className="border-t p-3">{logoutButton}</div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 border-b bg-card px-4 py-3 md:hidden print:hidden">
            <div>
              <p className="text-sm font-semibold">{dictionary.appName}</p>
              <p className="text-xs text-muted-foreground">{profile?.full_name}</p>
            </div>
            {logoutButton}
          </header>
          <nav className="flex gap-1 overflow-x-auto border-b bg-card px-2 py-2 print:hidden md:hidden">
            {navItems(false)}
          </nav>
          <main className="flex flex-1 flex-col gap-3 bg-muted/40 p-4">
            {showPushBanner && profile ? <PushOptInBanner userId={profile.id} /> : null}
            <Outlet />
          </main>
        </div>
      </div>
    );
  }

  const nav = (
    <nav
      className={cn(
        "flex gap-1 border-border bg-card",
        navPosition === "bottom"
          ? "fixed inset-x-0 bottom-0 z-20 mx-auto max-w-3xl border-t px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2"
          : "overflow-x-auto border-b px-2 py-2",
      )}
    >
      {navItems(false)}
    </nav>
  );

  return (
    <div className={cn("mx-auto flex min-h-dvh w-full flex-col", wide ? "max-w-6xl" : "max-w-3xl")}>
      <header className="flex items-center justify-between gap-3 border-b bg-card px-4 py-3">
        <div>
          <p className="text-sm font-semibold">{dictionary.appName}</p>
          <p className="text-xs text-muted-foreground">{profile?.full_name}</p>
        </div>
        {logoutButton}
      </header>
      {navPosition === "top" ? nav : null}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2 p-3",
          navPosition === "bottom" && "pb-[calc(4.75rem+env(safe-area-inset-bottom))]",
        )}
      >
        {showPushBanner && profile ? <PushOptInBanner userId={profile.id} /> : null}
        <Outlet />
      </div>
      {navPosition === "bottom" ? nav : null}
    </div>
  );
}
