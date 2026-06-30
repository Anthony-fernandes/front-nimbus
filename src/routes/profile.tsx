import { useState, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getStoredUser, updateMyProfile, changePassword } from "@/services/authService";
import { api } from "@/services/api";
import { parseApiError } from "@/services/utils";
import type { User } from "@/lib/types";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Meu perfil - NimbusDesk" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const currentUser = getStoredUser<User>();

  const [profileForm, setProfileForm] = useState({
    first_name: currentUser?.first_name ?? "",
    last_name: currentUser?.last_name ?? "",
    email: currentUser?.email ?? "",
    phone: (currentUser as { phone?: string } | null)?.phone ?? "",
    job_title: (currentUser as { job_title?: string } | null)?.job_title ?? "",
  });
  const profileMutation = useMutation({
    mutationFn: () => updateMyProfile(profileForm),
    onSuccess: () => toast.success("Perfil atualizado."),
    onError: () => toast.error("Não foi possível salvar."),
  });

  const [passwordForm, setPasswordForm] = useState({ senha_atual: "", nova_senha: "", confirmar_senha: "" });
  const [showPwd, setShowPwd] = useState({ atual: false, nova: false, confirmar: false });

  const passwordStrength = useCallback((pwd: string) => {
    if (!pwd) return null;
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { label: "Fraca", color: "bg-destructive", cls: "text-destructive", w: "w-1/4" };
    if (score <= 2) return { label: "Regular", color: "bg-warning", cls: "text-warning", w: "w-2/4" };
    if (score <= 3) return { label: "Boa", color: "bg-blue-500", cls: "text-blue-400", w: "w-3/4" };
    return { label: "Forte", color: "bg-success", cls: "text-success", w: "w-full" };
  }, []);

  const passwordMutation = useMutation({
    mutationFn: () => changePassword(passwordForm.senha_atual, passwordForm.nova_senha),
    onSuccess: () => {
      toast.success("Senha alterada com sucesso.");
      setPasswordForm({ senha_atual: "", nova_senha: "", confirmar_senha: "" });
    },
    onError: () => toast.error("Não foi possível alterar a senha. Verifique a senha atual."),
  });

  return (
    <AppShell>
      <div className="max-w-7xl space-y-5">
        <PageHeader
          crumbs={[{ label: "Workspace", to: "/" }, { label: "Meu perfil" }]}
          title="Meu perfil"
          subtitle="Gerencie suas informações pessoais e segurança de acesso."
        />

        <div className="max-w-xl space-y-5">
          {/* Avatar + identidade */}
          <div className="glass rounded-2xl shadow-card p-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 shrink-0 rounded-2xl bg-gradient-primary grid place-items-center shadow-glow">
                <span className="text-xl font-bold text-primary-foreground">
                  {[currentUser?.first_name, currentUser?.last_name].filter(Boolean).map((n) => n![0].toUpperCase()).join("") || currentUser?.username?.[0]?.toUpperCase() || "?"}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-lg leading-tight truncate">
                  {[currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(" ") || currentUser?.username}
                </p>
                <p className="text-sm text-muted-foreground truncate">{currentUser?.email}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {currentUser?.is_superuser && (
                    <span className="rounded-full bg-violet-500/15 text-violet-400 px-2 py-0.5 text-[10px] font-semibold">Superadmin</span>
                  )}
                  {currentUser?.is_staff && !currentUser?.is_superuser && (
                    <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold">Staff</span>
                  )}
                  {(currentUser as { role?: string } | null)?.role && (
                    <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-medium">
                      {(currentUser as { role?: string }).role}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Dados pessoais */}
          <div className="glass rounded-2xl shadow-card p-6 space-y-5">
            <div>
              <h2 className="font-semibold">Informações pessoais</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Dados visíveis para outros membros da equipe.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {(
                [
                  { key: "first_name", label: "Nome" },
                  { key: "last_name", label: "Sobrenome" },
                ] as const
              ).map(({ key, label }) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <Input
                    value={profileForm[key]}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            {(
              [
                { key: "email", label: "E-mail", type: "email" },
                { key: "phone", label: "Telefone", type: "tel" },
                { key: "job_title", label: "Cargo / Título", type: "text" },
              ] as const
            ).map(({ key, label, type }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input
                  type={type}
                  value={profileForm[key]}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            ))}
            <Button
              onClick={() => profileMutation.mutate()}
              disabled={profileMutation.isPending}
              className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
            >
              {profileMutation.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>

          {/* Segurança / Senha */}
          <div className="glass rounded-2xl shadow-card p-6 space-y-5">
            <div>
              <h3 className="font-semibold">Segurança</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Altere sua senha de acesso.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Senha atual</Label>
              <div className="relative">
                <Input
                  type={showPwd.atual ? "text" : "password"}
                  value={passwordForm.senha_atual}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, senha_atual: e.target.value }))}
                  className="pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((p) => ({ ...p, atual: !p.atual }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPwd.atual ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nova senha</Label>
              <div className="relative">
                <Input
                  type={showPwd.nova ? "text" : "password"}
                  value={passwordForm.nova_senha}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, nova_senha: e.target.value }))}
                  className="pr-10"
                  placeholder="Mínimo 8 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((p) => ({ ...p, nova: !p.nova }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPwd.nova ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordStrength(passwordForm.nova_senha) && (() => {
                const s = passwordStrength(passwordForm.nova_senha)!;
                return (
                  <div className="space-y-1 pt-1">
                    <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${s.color} ${s.w}`} />
                    </div>
                    <p className={`text-[10px] font-medium ${s.cls}`}>Senha {s.label.toLowerCase()}</p>
                  </div>
                );
              })()}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Confirmar nova senha</Label>
              <div className="relative">
                <Input
                  type={showPwd.confirmar ? "text" : "password"}
                  value={passwordForm.confirmar_senha}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmar_senha: e.target.value }))}
                  className={`pr-10 ${passwordForm.confirmar_senha && passwordForm.nova_senha !== passwordForm.confirmar_senha ? "border-destructive/60" : ""}`}
                  placeholder="Repita a nova senha"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((p) => ({ ...p, confirmar: !p.confirmar }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPwd.confirmar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordForm.confirmar_senha && passwordForm.nova_senha !== passwordForm.confirmar_senha && (
                <p className="text-[10px] text-destructive">As senhas não coincidem</p>
              )}
            </div>

            <Button
              onClick={() => {
                if (passwordForm.nova_senha.length < 8) {
                  toast.error("A nova senha deve ter no mínimo 8 caracteres.");
                  return;
                }
                if (passwordForm.nova_senha !== passwordForm.confirmar_senha) {
                  toast.error("As senhas não coincidem.");
                  return;
                }
                if (!passwordForm.senha_atual) {
                  toast.error("Informe a senha atual.");
                  return;
                }
                passwordMutation.mutate();
              }}
              disabled={passwordMutation.isPending}
              className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
            >
              {passwordMutation.isPending ? "Alterando..." : "Alterar senha"}
            </Button>
          </div>

          <MfaSection />
        </div>
      </div>
    </AppShell>
  );
}

function MfaSection() {
  const queryClient = useQueryClient();
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [setupData, setSetupData] = useState<{ secret: string; qr_url: string } | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [disabling, setDisabling] = useState(false);

  const { data: mfaStatus, isLoading: mfaLoading } = useQuery({
    queryKey: ["mfa-status"],
    queryFn: async () => {
      const response = await api.get<{ mfa_enabled: boolean }>("/auth/mfa/status/");
      return response.data;
    },
  });

  const mfaEnabled = mfaStatus?.mfa_enabled ?? false;

  const handleOpenSetup = async () => {
    setLoadingSetup(true);
    try {
      const response = await api.get<{ secret: string; qr_url: string }>("/auth/mfa/setup/");
      setSetupData(response.data);
      setSetupCode("");
      setSetupOpen(true);
    } catch (error) {
      toast.error(parseApiError(error, "Não foi possível carregar a configuração MFA."));
    } finally {
      setLoadingSetup(false);
    }
  };

  const handleConfirmSetup = async () => {
    setConfirming(true);
    try {
      await api.post("/auth/mfa/setup/confirm/", { totp_code: setupCode });
      toast.success("Autenticacao em dois fatores ativada com sucesso.");
      setSetupOpen(false);
      setSetupData(null);
      setSetupCode("");
      await queryClient.invalidateQueries({ queryKey: ["mfa-status"] });
    } catch (error) {
      toast.error(parseApiError(error, "Código inválido. Tente novamente."));
    } finally {
      setConfirming(false);
    }
  };

  const handleDisable = async () => {
    setDisabling(true);
    try {
      await api.post("/auth/mfa/disable/", { totp_code: disableCode });
      toast.success("Autenticacao em dois fatores desativada.");
      setDisableOpen(false);
      setDisableCode("");
      await queryClient.invalidateQueries({ queryKey: ["mfa-status"] });
    } catch (error) {
      toast.error(parseApiError(error, "Código inválido. Tente novamente."));
    } finally {
      setDisabling(false);
    }
  };

  return (
    <>
      <div className="glass rounded-2xl p-5 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center shrink-0">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">Autenticacao em dois fatores</h2>
                {!mfaLoading && mfaEnabled && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-green-400">
                    <ShieldCheck className="h-3 w-3" />
                    Ativo
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {mfaEnabled
                  ? "Sua conta esta protegida com autenticacao em dois fatores."
                  : "Adicione uma camada extra de seguranca a sua conta."}
              </p>
            </div>
          </div>
          <div className="shrink-0">
            {mfaLoading ? null : mfaEnabled ? (
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => { setDisableCode(""); setDisableOpen(true); }}
              >
                <ShieldOff className="h-4 w-4" />
                Desativar
              </Button>
            ) : (
              <Button
                type="button"
                className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                onClick={handleOpenSetup}
                disabled={loadingSetup}
              >
                <ShieldCheck className="h-4 w-4" />
                Ativar autenticacao em dois fatores
              </Button>
            )}
          </div>
        </div>
      </div>

      <Dialog open={setupOpen} onOpenChange={(open) => { if (!open) { setSetupOpen(false); setSetupData(null); setSetupCode(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ativar autenticacao em dois fatores</DialogTitle>
            <DialogDescription>
              Escaneie o QR code ou insira o segredo manualmente no seu aplicativo autenticador, depois confirme com o código gerado.
            </DialogDescription>
          </DialogHeader>

          {setupData && (
            <div className="space-y-4 py-2">
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-lg border border-border bg-white p-3">
                  <img
                    src={setupData.qr_url}
                    alt="QR Code MFA"
                    className="h-44 w-44"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
                <div className="w-full">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                    Ou insira o segredo manualmente
                  </p>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(setupData.secret); toast.success("Segredo copiado!"); }}
                    className="w-full rounded-lg bg-muted/40 border border-border px-3 py-2 text-left font-mono text-xs text-muted-foreground hover:border-primary/40 transition break-all"
                    title="Clique para copiar"
                  >
                    {setupData.secret}
                  </button>
                </div>
              </div>

              <div>
                <label className="block">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Código de verificacao (6 digitos)
                  </span>
                  <input
                    autoFocus
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={setupCode}
                    onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className="mt-1 w-full h-10 rounded-lg bg-muted/40 border border-border px-3 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition tracking-widest"
                  />
                </label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setSetupOpen(false); setSetupData(null); setSetupCode(""); }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
              onClick={handleConfirmSetup}
              disabled={confirming || setupCode.length < 6}
            >
              {confirming ? "Confirmando..." : "Confirmar ativacao"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={disableOpen} onOpenChange={(open) => { if (!open) { setDisableOpen(false); setDisableCode(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Desativar autenticacao em dois fatores</DialogTitle>
            <DialogDescription>
              Para confirmar, insira o código atual do seu aplicativo autenticador.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Código de verificacao (6 digitos)
              </span>
              <input
                autoFocus
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="mt-1 w-full h-10 rounded-lg bg-muted/40 border border-border px-3 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition tracking-widest"
              />
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setDisableOpen(false); setDisableCode(""); }}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleDisable}
              disabled={disabling || disableCode.length < 6}
            >
              {disabling ? "Desativando..." : "Confirmar desativacao"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
