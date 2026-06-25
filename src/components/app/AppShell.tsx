import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import { Bell, Check, CheckCheck, Command, LogOut, Menu, Plus, Search, Settings } from "lucide-react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/notificationService";
import type { AppNotification } from "@/lib/types";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
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
import { GlobalSearch } from "./GlobalSearch";
import { ThemeSwitcher } from "./ThemeSwitcher";

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
  return (
    <SidebarProvider>
      <AppShellInner>{children}</AppShellInner>
    </SidebarProvider>
  );
}

function AppShellInner({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [user, setUser] = useState<User | null>(() => getStoredUser<User>());
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toggleSidebar } = useSidebar();
  const initials = getUserInitials(user);
  const createRoute = getCreateRoute(pathname, user);
  const clientUser = isClientUser(user);
  const showCreateButton = useMemo(
    () => canCreateFromPath(pathname, user),
    [pathname, user],
  );

  useInactivityLogout();

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
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  const handleHamburgerClick = () => {
    setSidebarOpen((prev) => !prev);
    toggleSidebar();
  };

  return (
    <>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      {/* Mobile backdrop overlay */}
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => {
            setSidebarOpen(false);
            toggleSidebar();
          }}
          aria-hidden="true"
        />
      ) : null}
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar user={user} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="glass-strong sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border px-4">
            {/* Hamburger button — mobile only */}
            <button
              type="button"
              aria-label="Abrir menu"
              onClick={handleHamburgerClick}
              className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            {/* Desktop sidebar trigger */}
            <SidebarTrigger className="hidden text-muted-foreground hover:text-foreground lg:grid" />
            <div className="hidden min-w-[280px] cursor-text items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 md:flex md:h-9" onClick={() => setSearchOpen(true)}>
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
            <ThemeSwitcher />
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
    </>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: unread = 0 } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: getUnreadCount,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications-list"],
    queryFn: () => listNotifications({ page_size: 20, is_read: false }),
    enabled: open,
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications-list"] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications-list"] });
    },
  });

  // Fechar ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const items = Array.isArray(notifications)
    ? (notifications as AppNotification[])
    : ((notifications as { results?: AppNotification[] }).results ?? []);

  return (
    <div ref={ref} className="relative">
      <button
        title="Notificações"
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-9 w-9 place-items-center rounded-lg transition-colors hover:bg-muted/50"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-semibold text-destructive-foreground">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-2xl border border-border bg-background shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold">Notificações</span>
            {unread > 0 ? (
              <button
                className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                onClick={() => markAllMutation.mutate()}
                disabled={markAllMutation.isPending}
              >
                <CheckCheck className="h-3 w-3" />
                Marcar todas como lidas
              </button>
            ) : null}
          </div>

          {/* Lista */}
          <div className="max-h-[400px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhuma notificação não lida.
              </div>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className="group flex cursor-pointer items-start gap-3 border-b border-border/50 px-4 py-3 transition-colors last:border-0 hover:bg-muted/30"
                  onClick={() => {
                    markReadMutation.mutate(n.id);
                    if (n.link) window.location.assign(n.link);
                    else setOpen(false);
                  }}
                >
                  <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium leading-snug">{n.title}</div>
                    {n.message ? (
                      <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{n.message}</div>
                    ) : null}
                    {n.created_at ? (
                      <div className="mt-1 text-[10px] text-muted-foreground/60">
                        {new Date(n.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </div>
                    ) : null}
                  </div>
                  <button
                    className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    title="Marcar como lida"
                    onClick={(e) => {
                      e.stopPropagation();
                      markReadMutation.mutate(n.id);
                    }}
                  >
                    <Check className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-4 py-2.5">
            <Link
              to="/inbox"
              className="block text-center text-xs text-primary hover:underline"
              onClick={() => setOpen(false)}
            >
              Ver todas as notificações →
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
