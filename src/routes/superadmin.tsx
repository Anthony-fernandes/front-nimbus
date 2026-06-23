import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, MessageCircle, MessageSquare, Plus, Shield, Ticket, TrendingUp, UserPlus, Power } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getStoredUser } from "@/services/authService";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import {
  listAllCompanies,
  createCompany,
  setupCompanyAdmin,
  toggleCompanyActive,
  type SuperAdminCompany,
  type CreateCompanyData,
  type SetupAdminData,
} from "@/services/superAdminService";

async function fetchAdminStats() {
  const r = await api.get("/admin-dashboard/stats/");
  return r.data as {
    forum: { topics: number; replies: number; active_users: number };
    kb: { articles: number; avg_rating: number };
    tickets: { open: number; closed: number };
    chat: { active_conversations: number };
  };
}

export const Route = createFileRoute("/superadmin")({
  head: () => ({ meta: [{ title: "Super Admin - Nimbus" }] }),
  component: SuperAdminPage,
});

const emptyCompanyForm: CreateCompanyData = { name: "", document: "", email: "", phone: "" };
const emptyAdminForm: SetupAdminData = { username: "", email: "", password: "", first_name: "", last_name: "" };

function SuperAdminPage() {
  const navigate = useNavigate();
  const currentUser = getStoredUser<User>();
  const isSuperAdmin = currentUser?.is_staff || currentUser?.is_superuser;

  if (!isSuperAdmin) {
    void navigate({ to: "/access-denied" });
    return null;
  }

  return <SuperAdminContent />;
}

function SuperAdminContent() {
  const queryClient = useQueryClient();

  const statsQuery = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: fetchAdminStats,
    refetchInterval: 60_000,
  });

  const stats = statsQuery.data;

  // Create company dialog
  const [newCompanyOpen, setNewCompanyOpen] = useState(false);
  const [companyForm, setCompanyForm] = useState<CreateCompanyData>(emptyCompanyForm);

  // Setup admin dialog
  const [adminDialogCompany, setAdminDialogCompany] = useState<SuperAdminCompany | null>(null);
  const [adminForm, setAdminForm] = useState<SetupAdminData>(emptyAdminForm);

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["superadmin-companies"],
    queryFn: listAllCompanies,
  });

  const createCompanyMutation = useMutation({
    mutationFn: (data: CreateCompanyData) => createCompany(data),
    onSuccess: () => {
      toast.success("Empresa criada com sucesso.");
      void queryClient.invalidateQueries({ queryKey: ["superadmin-companies"] });
      setNewCompanyOpen(false);
      setCompanyForm(emptyCompanyForm);
    },
    onError: () => toast.error("Nao foi possivel criar a empresa."),
  });

  const setupAdminMutation = useMutation({
    mutationFn: ({ companyId, data }: { companyId: string; data: SetupAdminData }) =>
      setupCompanyAdmin(companyId, data),
    onSuccess: () => {
      toast.success("Admin configurado com sucesso.");
      setAdminDialogCompany(null);
      setAdminForm(emptyAdminForm);
    },
    onError: () => toast.error("Nao foi possivel configurar o admin."),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      toggleCompanyActive(id, isActive),
    onSuccess: (_, vars) => {
      toast.success(vars.isActive ? "Empresa ativada." : "Empresa desativada.");
      void queryClient.invalidateQueries({ queryKey: ["superadmin-companies"] });
    },
    onError: () => toast.error("Nao foi possivel alterar o status."),
  });

  return (
    <AppShell>
      <div className="max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center shrink-0">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Super Admin</h1>
              <p className="text-xs text-muted-foreground">Gerenciamento de empresas e onboarding de clientes.</p>
            </div>
          </div>
          <Button
            type="button"
            className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
            onClick={() => { setCompanyForm(emptyCompanyForm); setNewCompanyOpen(true); }}
          >
            <Plus className="h-4 w-4" />
            Nova empresa
          </Button>
        </div>

        {/* Unified stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: MessageSquare, label: "Tópicos do fórum", value: stats.forum.topics, sub: `${stats.forum.replies} respostas`, color: "bg-blue-400/10 text-blue-400" },
              { icon: BookOpen, label: "Artigos KB", value: stats.kb.articles, sub: `Nota média ${stats.kb.avg_rating}`, color: "bg-green-500/10 text-green-500" },
              { icon: Ticket, label: "Chamados abertos", value: stats.tickets.open, sub: `${stats.tickets.closed} fechados`, color: "bg-yellow-400/10 text-yellow-400" },
              { icon: MessageCircle, label: "Conversas ativas", value: stats.chat.active_conversations, sub: "Chat interno", color: "bg-purple-400/10 text-purple-400" },
            ].map(({ icon: Icon, label, value, sub, color }) => (
              <div key={label} className="glass rounded-2xl p-4 flex items-center gap-3 shadow-card">
                <div className={cn("h-10 w-10 rounded-xl grid place-items-center shrink-0", color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none">{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                  <p className="text-[10px] text-muted-foreground/70">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Companies table */}
        <div className="glass overflow-hidden rounded-2xl shadow-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold">Empresas cadastradas</h2>
            <p className="text-xs text-muted-foreground">Todos os tenants da plataforma NimbusDesk.</p>
          </div>

          {isLoading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : companies.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma empresa cadastrada.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">Empresa</th>
                    <th className="px-2 py-2.5 text-left font-medium">CNPJ</th>
                    <th className="px-2 py-2.5 text-left font-medium">E-mail</th>
                    <th className="px-2 py-2.5 text-left font-medium">Telefone</th>
                    <th className="px-2 py-2.5 text-left font-medium">Status</th>
                    <th className="px-4 py-2.5 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => (
                    <tr key={company.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{company.name}</td>
                      <td className="px-2 py-3 font-mono text-xs text-muted-foreground">
                        {company.document || "—"}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">{company.email || "—"}</td>
                      <td className="px-2 py-3 text-muted-foreground">{company.phone || "—"}</td>
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            toggleActiveMutation.mutate({ id: company.id, isActive: !company.is_active })
                          }
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider transition-colors",
                            company.is_active
                              ? "bg-green-500/15 text-green-400 hover:bg-green-500/25"
                              : "bg-muted/40 text-muted-foreground hover:bg-muted/60",
                          )}
                        >
                          {company.is_active ? "Ativo" : "Inativo"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => {
                              setAdminDialogCompany(company);
                              setAdminForm(emptyAdminForm);
                            }}
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            Configurar admin
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className={cn(
                              "gap-1.5",
                              company.is_active
                                ? "border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                : "border-green-500/40 text-green-400 hover:bg-green-500/10 hover:text-green-400",
                            )}
                            onClick={() =>
                              toggleActiveMutation.mutate({ id: company.id, isActive: !company.is_active })
                            }
                          >
                            <Power className="h-3.5 w-3.5" />
                            {company.is_active ? "Desativar" : "Ativar"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Company Dialog */}
        <Dialog open={newCompanyOpen} onOpenChange={setNewCompanyOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nova empresa</DialogTitle>
              <DialogDescription>
                Cadastre um novo tenant na plataforma NimbusDesk.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {(
                [
                  { key: "name" as const, label: "Nome da empresa", type: "text", required: true },
                  { key: "document" as const, label: "CNPJ / Documento", type: "text", required: false },
                  { key: "email" as const, label: "E-mail de contato", type: "email", required: false },
                  { key: "phone" as const, label: "Telefone", type: "tel", required: false },
                ]
              ).map(({ key, label, type }) => (
                <div key={key} className="space-y-1">
                  <Label>{label}</Label>
                  <Input
                    type={type}
                    value={companyForm[key]}
                    onChange={(e) => setCompanyForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={label}
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewCompanyOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                onClick={() => {
                  if (!companyForm.name.trim()) {
                    toast.error("O nome da empresa e obrigatório.");
                    return;
                  }
                  createCompanyMutation.mutate(companyForm);
                }}
                disabled={createCompanyMutation.isPending}
              >
                {createCompanyMutation.isPending ? "Criando..." : "Criar empresa"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Setup Admin Dialog */}
        <Dialog
          open={!!adminDialogCompany}
          onOpenChange={(open) => { if (!open) setAdminDialogCompany(null); }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Configurar admin</DialogTitle>
              <DialogDescription>
                Crie o primeiro usuário administrador para{" "}
                <strong>{adminDialogCompany?.name}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Nome</Label>
                  <Input
                    value={adminForm.first_name}
                    onChange={(e) => setAdminForm((p) => ({ ...p, first_name: e.target.value }))}
                    placeholder="Nome"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Sobrenome</Label>
                  <Input
                    value={adminForm.last_name}
                    onChange={(e) => setAdminForm((p) => ({ ...p, last_name: e.target.value }))}
                    placeholder="Sobrenome"
                  />
                </div>
              </div>
              {(
                [
                  { key: "email" as const, label: "E-mail", type: "email" },
                  { key: "username" as const, label: "Username", type: "text" },
                  { key: "password" as const, label: "Senha inicial", type: "password" },
                ]
              ).map(({ key, label, type }) => (
                <div key={key} className="space-y-1">
                  <Label>{label}</Label>
                  <Input
                    type={type}
                    value={adminForm[key]}
                    onChange={(e) => setAdminForm((p) => ({ ...p, [key]: e.target.value }))}
                    placeholder={label}
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAdminDialogCompany(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                onClick={() => {
                  if (!adminDialogCompany) return;
                  if (!adminForm.username || !adminForm.email || !adminForm.password) {
                    toast.error("Username, e-mail e senha sao obrigatórios.");
                    return;
                  }
                  setupAdminMutation.mutate({ companyId: adminDialogCompany.id, data: adminForm });
                }}
                disabled={setupAdminMutation.isPending}
              >
                {setupAdminMutation.isPending ? "Configurando..." : "Criar admin"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
