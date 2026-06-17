import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Blocks,
  BookOpen,
  Building2,
  ClipboardCheck,
  Columns3,
  FolderKanban,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  ListTodo,
  Mail,
  MessageCircle,
  MessagesSquare,
  PencilRuler,
  Rocket,
  Settings,
  Sparkles,
  Tags,
  Ticket,
  Users,
  UsersRound,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  getUserClientName,
  getUserDisplayName,
  getUserInitials,
  getUserRole,
  isClientUser,
} from "@/lib/auth";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";
import type { User } from "@/lib/types";

type MenuItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  visible: boolean;
};

function getInternalMenu(user: User | null | undefined) {
  const workspace: MenuItem[] = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard, visible: true },
    { title: "Caixa de entrada", url: "/inbox", icon: Inbox, visible: true },
    {
      title: "Aprovacoes",
      url: "/aprovacoes",
      icon: ClipboardCheck,
      visible: hasAnyPermission(user, [
        "tickets.approve",
        "tickets.viewAll",
        "tickets.viewAssigned",
      ]),
    },
    {
      title: "Chamados",
      url: "/tickets",
      icon: Ticket,
      visible: hasAnyPermission(user, [
        "tickets.viewAll",
        "tickets.viewAssigned",
        "tickets.viewTeam",
        "tickets.viewOwn",
        "tickets.create",
      ]),
    },
    {
      title: "Projetos",
      url: "/projects",
      icon: FolderKanban,
      visible: hasPermission(user, "projects.view"),
    },
    {
      title: "Sprints",
      url: "/sprints",
      icon: Rocket,
      visible: hasPermission(user, "sprints.view"),
    },
    {
      title: "Kanban",
      url: "/kanban",
      icon: Columns3,
      visible: hasAnyPermission(user, ["activities.view", "projects.view", "sprints.view"]),
    },
    {
      title: "Backlog",
      url: "/backlog",
      icon: ListTodo,
      visible: hasAnyPermission(user, ["activities.view", "projects.view"]),
    },
    { title: "Conhecimento", url: "/knowledge", icon: BookOpen, visible: true },
    { title: "Forum", url: "/forum", icon: MessagesSquare, visible: true },
    { title: "Duvidas", url: "/doubts", icon: HelpCircle, visible: true },
    { title: "Chat", url: "/chat", icon: MessageCircle, visible: true },
  ].filter((item) => item.visible);

  const management: MenuItem[] = [
    {
      title: "Organizacoes",
      url: "/clients",
      icon: Users,
      visible: hasPermission(user, "clients.view"),
    },
    {
      title: "Usuarios",
      url: "/teams",
      icon: UsersRound,
      visible: hasAnyPermission(user, ["users.view", "users.manage", "users.managePermissions"]),
    },
    {
      title: "Organizacao",
      url: "/org",
      icon: Building2,
      visible: hasAnyPermission(user, ["users.manage", "users.managePermissions"]),
    },
    {
      title: "Categorias",
      url: "/ticket-categories",
      icon: Tags,
      visible: hasAnyPermission(user, ["categories.view", "categories.manage"]),
    },
    {
      title: "Relatorios",
      url: "/reports",
      icon: BarChart3,
      visible: hasPermission(user, "reports.view"),
    },
    {
      title: "Configuracoes",
      url: "/settings",
      icon: Settings,
      visible: hasAnyPermission(user, ["settings.view", "settings.edit", "categories.view"]),
    },
    {
      title: "Editor dashboards",
      url: "/dashboard-builder",
      icon: PencilRuler,
      visible: getUserRole(user) === "ADMIN" || hasPermission(user, "settings.edit"),
    },
    {
      title: "Blocos de permissoes",
      url: "/permission-blocks",
      icon: Blocks,
      visible: hasAnyPermission(user, [
        "permissionBlocks.view",
        "permissionBlocks.manage",
        "users.managePermissions",
      ]),
    },
    {
      title: "Email Templates",
      url: "/email-templates",
      icon: Mail,
      visible: hasPermission(user, "settings.edit") || getUserRole(user) === "ADMIN",
    },
  ].filter((item) => item.visible);

  return { workspace, management };
}

function getClientMenu(user: User | null | undefined) {
  return [
    { title: "Portal", url: "/client", icon: LayoutDashboard, visible: true },
    {
      title: "Meus chamados",
      url: "/client/tickets",
      icon: Ticket,
      visible: hasAnyPermission(user, ["tickets.viewOwn", "tickets.viewOrganization"]),
    },
    {
      title: "Novo chamado",
      url: "/client/tickets/new",
      icon: Ticket,
      visible: hasPermission(user, "tickets.create"),
    },
  ].filter((item) => item.visible);
}

export function AppSidebar({ user: externalUser }: { user?: User | null }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (router) => router.location.pathname });
  const user = externalUser || null;
  const clientUser = isClientUser(user);
  const internalMenu = getInternalMenu(user);
  const clientMenu = getClientMenu(user);
  const displayName = getUserDisplayName(user);
  const initials = getUserInitials(user);
  const clientName = getUserClientName(user);
  const isActive = (url: string) => (url === "/" ? path === "/" : path.startsWith(url));

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-primary shadow-glow">
            <Sparkles className="h-4.5 w-4.5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          {!collapsed ? (
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">
                Nimbus<span className="text-gradient">.io</span>
              </div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {clientUser ? "Portal do cliente" : "Portal interno"}
              </div>
            </div>
          ) : null}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed ? (
            <SidebarGroupLabel>{clientUser ? "Minha area" : "Workspace"}</SidebarGroupLabel>
          ) : null}
          <SidebarGroupContent>
            <SidebarMenu>
              {(clientUser ? clientMenu : internalMenu.workspace).map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="group">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!clientUser && internalMenu.management.length ? (
          <SidebarGroup>
            {!collapsed ? <SidebarGroupLabel>Gestao</SidebarGroupLabel> : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {internalMenu.management.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed ? (
          <div className="glass m-1 rounded-xl p-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-primary text-xs font-semibold text-primary-foreground">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{displayName}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {clientUser ? clientName || "Conta da organizacao" : "Workspace interno"}
                </div>
              </div>
              <span className="h-2 w-2 animate-pulse-glow rounded-full bg-success" />
            </div>
          </div>
        ) : (
          <div className="grid place-items-center py-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-primary text-xs font-semibold text-primary-foreground">
              {initials}
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
