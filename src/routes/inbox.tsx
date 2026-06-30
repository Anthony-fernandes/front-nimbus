import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Bell,
  CheckCheck,
  Filter,
  Inbox as InboxIcon,
  Mail,
  MailOpen,
  Search,
  Star,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/lib/types";
import {
  archiveNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  toggleNotificationFavorite,
} from "@/services/notificationService";

export const Route = createFileRoute("/inbox")({
  head: () => ({ meta: [{ title: "Caixa de entrada · Stratos Suite" }] }),
  component: InboxPage,
});

const CATEGORIES = [
  "Todos",
  "Chamados",
  "Aprovações",
  "Projetos",
  "Atividades",
  "Comentarios",
  "Sistema",
] as const;

type CategoryFilter = (typeof CATEGORIES)[number];
type ReadFilter = "all" | "unread" | "favorites" | "archived";

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CATEGORY_STYLE: Record<string, string> = {
  Chamados: "bg-primary/15 text-primary",
  Aprovações: "bg-warning/15 text-warning",
  Projetos: "bg-info/15 text-info",
  Atividades: "bg-success/15 text-success",
  Comentarios: "bg-accent/30 text-foreground",
  Sistema: "bg-muted text-muted-foreground",
};

function InboxPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<CategoryFilter>("Todos");
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const params = useMemo(() => {
    const next: Record<string, unknown> = { ordering: "-created_at" };
    if (category !== "Todos") next.category = category;
    if (readFilter === "unread") next.is_read = false;
    if (readFilter === "favorites") next.is_favorite = true;
    if (readFilter === "archived") next.is_archived = true;
    else next.is_archived = false;
    return next;
  }, [category, readFilter]);

  const notificationsQuery = useQuery({
    queryKey: ["notifications", params],
    queryFn: () => listNotifications(params),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
  }

  const readMutation = useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) =>
      read ? markNotificationRead(id) : markNotificationUnread(id),
    onSuccess: invalidate,
  });

  const favoriteMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      toggleNotificationFavorite(id, value),
    onSuccess: invalidate,
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) => archiveNotification(id, value),
    onSuccess: invalidate,
  });

  const readAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      invalidate();
      toast.success("Todas as notificações foram marcadas como lidas.");
    },
  });

  const allNotifications = notificationsQuery.data ?? [];
  const notifications = searchQuery.trim()
    ? allNotifications.filter((n) => {
        const q = searchQuery.toLowerCase();
        return (
          (n.title ?? "").toLowerCase().includes(q) ||
          (n.message ?? "").toLowerCase().includes(q)
        );
      })
    : allNotifications;

  function openNotification(notification: AppNotification) {
    if (!notification.is_read) {
      readMutation.mutate({ id: notification.id, read: true });
    }
    if (notification.link) {
      navigate({ to: `/${notification.link.replace(/^\//, "")}` }).catch(() => undefined);
    }
  }

  return (
    <AppShell>
      <div className="max-w-5xl space-y-5">
        <PageHeader
          title="Caixa de entrada"
          subtitle="Acompanhe toda a movimentacao da plataforma em um unico lugar."
          badges={
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
              <InboxIcon className="h-4 w-4" />
            </span>
          }
          actions={
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => readAllMutation.mutate()}
              disabled={readAllMutation.isPending}
            >
              <CheckCheck className="h-3.5 w-3.5" /> Marcar tudo como lido
            </Button>
          }
        />

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar notificações..."
            className="h-9 w-full rounded-lg border border-border bg-muted/30 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Filtros
          </span>
          {(["all", "unread", "favorites", "archived"] as ReadFilter[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setReadFilter(value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                readFilter === value
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {value === "all"
                ? "Todos"
                : value === "unread"
                  ? "Nao lidos"
                  : value === "favorites"
                    ? "Favoritos"
                    : "Arquivados"}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-[11px] uppercase tracking-wide transition-colors",
                category === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {value}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {notificationsQuery.isLoading ? (
            <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
              Carregando notificações...
            </div>
          ) : notifications.length === 0 ? (
            <div className="glass flex flex-col items-center gap-2 rounded-2xl p-10 text-center">
              <Bell className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhuma notificacao por aqui.</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "glass flex items-start gap-3 rounded-2xl p-4 shadow-card transition-colors",
                  !notification.is_read && "border-l-2 border-l-primary",
                )}
              >
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => openNotification(notification)}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        CATEGORY_STYLE[notification.category || "Sistema"] ||
                          CATEGORY_STYLE.Sistema,
                      )}
                    >
                      {notification.category || "Sistema"}
                    </span>
                    <span
                      className={cn(
                        "truncate text-sm",
                        notification.is_read ? "font-medium text-foreground" : "font-semibold",
                      )}
                    >
                      {notification.title}
                    </span>
                  </div>
                  {notification.message ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {notification.message}
                    </p>
                  ) : null}
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    {notification.actor_name ? <span>{notification.actor_name}</span> : null}
                    <span>{formatDate(notification.created_at)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    title={notification.is_favorite ? "Remover favorito" : "Favoritar"}
                    onClick={() =>
                      favoriteMutation.mutate({
                        id: notification.id,
                        value: !notification.is_favorite,
                      })
                    }
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-warning"
                  >
                    <Star
                      className={cn("h-4 w-4", notification.is_favorite && "fill-warning text-warning")}
                    />
                  </button>
                  <button
                    type="button"
                    title={notification.is_read ? "Marcar como nao lido" : "Marcar como lido"}
                    onClick={() =>
                      readMutation.mutate({ id: notification.id, read: !notification.is_read })
                    }
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  >
                    {notification.is_read ? (
                      <Mail className="h-4 w-4" />
                    ) : (
                      <MailOpen className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    title={notification.is_archived ? "Desarquivar" : "Arquivar"}
                    onClick={() =>
                      archiveMutation.mutate({
                        id: notification.id,
                        value: !notification.is_archived,
                      })
                    }
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  >
                    <Archive className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
