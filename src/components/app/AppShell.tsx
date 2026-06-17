import { ReactNode, useEffect, useMemo, useState } from "react";
import { Bell, Command, LogOut, Plus, Search, Settings } from "lucide-react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { getUnreadCount } from "@/services/notificationService";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import type { User } from "@/lib/types";
import {
  getCreateRoute,
  getUserInitials,
  isClientRoute,
  isClientUser,
} from "@/lib/auth";
import { canAccessPath, hasPermission } from "@/lib/permissions";
import {
  AUTH_REQUIRED_EVENT,
  fetchCurrentUser,
  getStoredUser,
  isAuthenticated,
  logout,
} from "@/services/authService";
import { AppSidebar } from "./AppSidebar";

function canCreateFromPath(pathname: string, user: User | null) {
  if (!user) {
    return false;
  }

  if (isClientUser(user)) {
    return isClientRoute(pathname) && hasPermission(user, "tickets.create");
  }

  if (pathname === "/") {
    return hasPermission(user, "tickets.create");
  }

  if (pathname.startsWith("/projects")) {
    return hasPermission(user, "projects.create");
  }

  if (pathname.startsWith("/sprints")) {
    return hasPermission(user, "sprints.create");
  }

  if (pathname.startsWith("/activities") || pathname.startsWith("/backlog")) {
    return hasPermission(user, "activities.create");
  }

  if (pathname.startsWith("/teams")) {
    return hasPermission(user, "users.create") || hasPermission(user, "users.manage");
  }

  if (pathname.startsWith("/clients")) {
    return hasPermission(user, "clients.create");
  }

  if (pathname.startsWith("/tickets")) {
    return hasPermission(user, "tickets.create");
  }

  return false;
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [user, setUser] = useState<User | null>(() => getStoredUser<User>());
  const initials = getUserInitials(user);
  const createRoute = getCreateRoute(pathname, user);
  const clientUser = isClientUser(user);
  const showCreateButton = useMemo(
    () => canCreateFromPath(pathname, user),
    [pathname, user],
  );

  useEffect(() => {
    let active = true;

    async function syncSession() {
      if (typeof window !== "undefined" && !isAuthenticated()) {
        navigate({ to: "/login" });
        return;
      }

      const currentUser = user || (await fetchCurrentUser().catch(() => null));
      if (!active) return;

      if (!currentUser) {
        navigate({ to: "/login" });
        return;
      }

      setUser(currentUser);

      const access = canAccessPath(currentUser, pathname);
      if (!access.allowed && pathname !== "/access-denied") {
        navigate({ to: "/access-denied" });
      }
    }

    void syncSession();

    return () => {
      active = false;
    };
  }, [navigate, pathname, user]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleAuthRequired = () => {
      setUser(null);
      navigate({ to: "/login" });
    };

    window.addEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
    return () => {
      window.removeEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
    };
  }, [navigate]);

  return (
    <SidebarProvider>
      <div className="dark flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar user={user} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="glass-strong sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border px-4">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div className="hidden min-w-[280px] cursor-text items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 md:flex md:h-9">
              <Search className="h-4 w-4" />
              <span className="flex-1">
                {clientUser
                  ? "Buscar meus chamados..."
                  : "Buscar chamados, projetos e pessoas..."}
              </span>
              <kbd className="hidden items-center gap-0.5 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground md:inline-flex">
                <Command className="h-2.5 w-2.5" />K
              </kbd>
            </div>
            <div className="flex-1" />
            {showCreateButton ? (
              <Button
                asChild
                size="sm"
                className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
              >
                <a href={createRoute}>
                  <Plus className="h-4 w-4" /> {clientUser ? "Abrir chamado" : "Novo"}
                </a>
              </Button>
            ) : null}
            {!clientUser ? <NotificationBell /> : null}
            {!clientUser ? (
              <Link
                to="/notification-preferences"
                title="Preferências de notificação"
                className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                <Settings className="h-4 w-4" />
              </Link>
            ) : null}
            <button
              title="Sair"
              onClick={async () => {
                await logout();
                navigate({ to: "/login" });
              }}
              className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-primary text-xs font-semibold text-primary-foreground">
              {initials}
            </div>
          </header>
          <main className="flex-1 overflow-x-hidden p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function NotificationBell() {
  const { data: unread = 0 } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: () => getUnreadCount(),
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });

  return (
    <Link
      to="/inbox"
      title="Caixa de entrada"
      className="relative grid h-9 w-9 place-items-center rounded-lg transition-colors hover:bg-muted/50"
    >
      <Bell className="h-4 w-4" />
      {unread > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-semibold text-destructive-foreground">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
