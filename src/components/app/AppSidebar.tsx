import { Link, useRouterState } from "@tanstack/react-router";
import { BrandLogo } from "@/components/app/BrandLogo";
import { useQuery } from "@tanstack/react-query";
import { listChatConversations } from "@/services/chatService";
import { listTeams } from "@/services/teamService";
import { listSprints } from "@/services/sprintService";
import { useState } from "react";
import {
  BarChart3,
  Blocks,
  Bot,
  BookOpen,
  Building2,
  ClipboardCheck,
  Columns3,
  FolderKanban,
  FolderOpen,
  HelpCircle,
  LifeBuoy,
  Shield,
  ShieldCheck,
  LayoutDashboard,
  ListTodo,
  Mail,
  MessageCircle,
  MessagesSquare,
  PencilRuler,
  Rocket,
  ChevronDown,
  ChevronRight,
  ScrollText,
  Settings,
  Tag,
  Tags,
  Ticket,
  Users,
  UsersRound,
  Webhook,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
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
import type { Sprint, User } from "@/lib/types";

type MenuItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  visible: boolean;
};

function getInternalMenu(user: User | null | undefined) {
  const workspace: MenuItem[] = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard, visible: true },
    {
      title: "Aprovações",
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
      title: "Equipes",
      url: "/equipes",
      icon: UsersRound,
      visible: hasAnyPermission(user, ["sprints.view", "users.view", "users.manage"]),
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
    { title: "Fórum", url: "/forum", icon: MessagesSquare, visible: true },
    { title: "Dúvidas", url: "/doubts", icon: HelpCircle, visible: true },
    { title: "Central de Ajuda", url: "/help", icon: LifeBuoy, visible: true },
    {
      title: "Categorias de Conteúdo",
      url: "/categories",
      icon: Tag,
      visible: getUserRole(user) !== "CLIENT",
    },
    { title: "Chat", url: "/chat", icon: MessageCircle, visible: true },
    { title: "Meu perfil", url: "/profile", icon: Settings, visible: getUserRole(user) !== "CLIENT" },
  ].filter((item) => item.visible);

  const management: MenuItem[] = [
    {
      title: "Clientes",
      url: "/clients",
      icon: Users,
      visible: hasPermission(user, "clients.view"),
    },
    {
      title: "Usuários",
      url: "/teams",
      icon: UsersRound,
      visible: hasAnyPermission(user, ["users.view", "users.manage", "users.managePermissions"]),
    },
    {
      title: "Estrutura Organizacional",
      url: "/org",
      icon: Building2,
      visible: hasAnyPermission(user, ["users.manage", "users.managePermissions"]),
    },
    {
      title: "Categorias de Chamados",
      url: "/ticket-categories",
      icon: Tags,
      visible: hasAnyPermission(user, ["categories.view", "categories.manage"]),
    },
    {
      title: "Relatórios",
      url: "/reports",
      icon: BarChart3,
      visible: hasPermission(user, "reports.view"),
    },
    {
      title: "SLA",
      url: "/sla",
      icon: ShieldCheck,
      visible: hasPermission(user, "reports.view"),
    },
    {
      title: "Configurações",
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
      title: "Blocos de permissões",
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
    {
      title: "Auditoria",
      url: "/audit",
      icon: ScrollText,
      visible: hasPermission(user, "settings.view") || getUserRole(user) === "ADMIN",
    },
    {
      title: "Automações",
      url: "/automations",
      icon: Bot,
      visible: getUserRole(user) === "ADMIN",
    },
    {
      title: "Webhooks",
      url: "/webhooks",
      icon: Webhook,
      visible: getUserRole(user) === "ADMIN",
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
  const activeSprintTeam = useRouterState({
    select: (router) => (router.location.search as { team?: string }).team || "",
  });
  const user = externalUser || null;
  const clientUser = isClientUser(user);
  const internalMenu = getInternalMenu(user);
  const clientMenu = getClientMenu(user);
  const displayName = getUserDisplayName(user);
  const initials = getUserInitials(user);
  const clientName = getUserClientName(user);
  const isActive = (url: string) => (url === "/" ? path === "/" : path.startsWith(url));

  const teamsQ = useQuery({
    queryKey: ["teams"],
    queryFn: listTeams,
    enabled: !clientUser,
    staleTime: 60000,
  });
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});
  const teams = (teamsQ.data ?? []).filter((t) => (t.status || "Ativa") === "Ativa");

  // Dropdown do item "Sprints": equipes → sprints de cada equipe
  const [sprintsOpen, setSprintsOpen] = useState(false);
  const sprintsQ = useQuery({
    queryKey: ["sidebar-sprints"],
    queryFn: () => listSprints(),
    enabled: !clientUser && sprintsOpen,
    staleTime: 60000,
  });
  const sprintsByTeam = (sprintsQ.data ?? []).reduce<Record<string, Sprint[]>>((acc, sprint) => {
    const key = sprint.team || "none";
    (acc[key] = acc[key] || []).push(sprint);
    return acc;
  }, {});
  const sprintTeamGroups = [
    ...teams.map((t) => ({ id: t.id, name: t.name, color: t.color || "#6366f1" })),
    ...(sprintsByTeam["none"]?.length ? [{ id: "none", name: "Sem equipe", color: "#94a3b8" }] : []),
  ];

  const chatConvsQ = useQuery({
    queryKey: ["chat-conversations"],
    queryFn: listChatConversations,
    refetchInterval: 30000,
    enabled: !clientUser,
  });
  const unreadChatCount: number = (chatConvsQ.data ?? []).reduce(
    (sum: number, c: { unread_count?: number }) => sum + (c.unread_count ?? 0),
    0,
  );

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="relative grid h-10 w-10 shrink-0 place-items-center">
            <BrandLogo className="h-10 w-10" />
          </div>
          {!collapsed ? (
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">
                Nimbus<span className="text-gradient">Desk</span>
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
            <SidebarGroupLabel>{clientUser ? "Minha área" : "Workspace"}</SidebarGroupLabel>
          ) : null}
          <SidebarGroupContent>
            <SidebarMenu>
              {(clientUser ? clientMenu : internalMenu.workspace).map((item) => {
                const badge = item.url === "/chat" && unreadChatCount > 0 ? unreadChatCount : null;

                // "Sprints" vira dropdown: equipes → sprints da equipe
                if (!clientUser && item.url === "/sprints" && !collapsed) {
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        isActive={isActive(item.url)}
                        tooltip={item.title}
                        onClick={() => setSprintsOpen((open) => !open)}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1">{item.title}</span>
                        {sprintsOpen ? (
                          <ChevronDown className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </SidebarMenuButton>
                      {sprintsOpen && (
                        <SidebarMenuSub>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={path === "/sprints" && !activeSprintTeam}>
                              <Link to="/sprints" search={{ team: "" }}>
                                <span>Todas as sprints</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          {sprintTeamGroups.map((group) => (
                            <SidebarMenuSubItem key={group.id}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={path === "/sprints" && activeSprintTeam === group.id}
                              >
                                <Link to="/sprints" search={{ team: group.id }}>
                                  <span
                                    className="h-2 w-2 shrink-0 rounded-sm"
                                    style={{ backgroundColor: group.color }}
                                  />
                                  <span className="flex-1 truncate">{group.name}</span>
                                  {sprintsByTeam[group.id]?.length ? (
                                    <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 text-[10px] leading-4 text-muted-foreground">
                                      {sprintsByTeam[group.id].length}
                                    </span>
                                  ) : null}
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  );
                }

                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link to={item.url} className="group">
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1">{item.title}</span>
                        {badge ? (
                          <span className="ml-auto flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
                            {badge > 99 ? "99+" : badge}
                          </span>
                        ) : null}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Equipes (navegação por contexto, estilo Monday) ── */}
        {!clientUser && !collapsed && teams.length > 0 ? (
          <SidebarGroup>
            <SidebarGroupLabel>Equipes</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {teams.map((team) => {
                  const expanded = expandedTeams[team.id] ?? false;
                  const teamLinks = [
                    { label: "Sprints", to: `/sprints?team=${team.id}` },
                    { label: "Tarefas", to: `/backlog?team=${team.id}&type=task` },
                    { label: "Chamados", to: `/backlog?team=${team.id}&type=ticket` },
                    { label: "Bugs", to: `/backlog?team=${team.id}&type=bug` },
                  ];
                  return (
                    <SidebarMenuItem key={team.id}>
                      <SidebarMenuButton
                        onClick={() =>
                          setExpandedTeams((prev) => ({ ...prev, [team.id]: !expanded }))
                        }
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: team.color || "#6366f1" }}
                        />
                        <span className="truncate">{team.name}</span>
                        {expanded ? (
                          <ChevronDown className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </SidebarMenuButton>
                      {expanded && (
                        <div className="ml-4 border-l border-border/60 pl-2">
                          {teamLinks.map((link) => (
                            <a
                              key={link.label}
                              href={link.to}
                              className="block rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                            >
                              {link.label}
                            </a>
                          ))}
                        </div>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

        {!clientUser && internalMenu.management.length ? (
          <SidebarGroup>
            {!collapsed ? <SidebarGroupLabel>Gestão</SidebarGroupLabel> : null}
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

        {!clientUser && (user?.is_staff || user?.is_superuser) ? (
          <SidebarGroup>
            {!collapsed ? <SidebarGroupLabel>Plataforma</SidebarGroupLabel> : null}
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/superadmin")} tooltip="Super Admin">
                    <Link to="/superadmin">
                      <Shield className="h-4 w-4" />
                      <span>Super Admin</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
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
                  {clientUser ? clientName || "Conta da organização" : "Workspace interno"}
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
