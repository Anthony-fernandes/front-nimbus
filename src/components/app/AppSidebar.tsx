import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Columns3,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
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
  isClientUser,
} from "@/lib/auth";
import type { User } from "@/lib/types";

const internalMain = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Chamados", url: "/tickets", icon: Ticket },
  { title: "Projetos", url: "/projects", icon: FolderKanban },
  { title: "Sprints", url: "/sprints", icon: Rocket },
  { title: "Kanban", url: "/kanban", icon: Columns3 },
  { title: "Backlog", url: "/backlog", icon: ListTodo },
];

const internalOrg = [
  { title: "Clientes", url: "/clients", icon: Users },
  { title: "Usuários", url: "/teams", icon: UsersRound },
  { title: "Categorias", url: "/ticket-categories", icon: Tags },
  { title: "Relatorios", url: "/reports", icon: BarChart3 },
  { title: "Configurações", url: "/settings", icon: Settings },
];

const clientMain = [
  { title: "Portal", url: "/client", icon: LayoutDashboard },
  { title: "Chamados", url: "/client/tickets", icon: Ticket },
  { title: "Projetos", url: "/client/projects", icon: FolderKanban },
];

export function AppSidebar({ user: externalUser }: { user?: User | null }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (router) => router.location.pathname });
  const user = externalUser || null;
  const clientUser = isClientUser(user);
  const mainItems = clientUser ? clientMain : internalMain;
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
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">
                Nimbus<span className="text-gradient">.io</span>
              </div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {clientUser ? "Portal do cliente" : "Workspace"}
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel>{clientUser ? "Minha area" : "Workspace"}</SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
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

        {!clientUser && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel>Organizacao</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {internalOrg.map((item) => (
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
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed ? (
          <div className="m-1 rounded-xl glass p-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-primary text-xs font-semibold text-primary-foreground">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{displayName}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {clientUser ? clientName || "Conta do cliente" : "Workspace interno"}
                </div>
              </div>
              <span className="h-2 w-2 rounded-full bg-success animate-pulse-glow" />
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
