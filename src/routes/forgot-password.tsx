import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Eye, EyeOff, CheckCircle2, ArrowLeft, KeyRound } from "lucide-react";
import { BrandLogo } from "@/components/app/BrandLogo";
import { useState } from "react";
import { toast } from "sonner";

import { requestPasswordReset, confirmPasswordReset } from "@/services/authService";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Esqueci minha senha · NimbusDesk" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground p-6">
      <div className="w-full max-w-sm glass-strong rounded-2xl p-8 shadow-card animate-fade-in-up">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <BrandLogo className="h-10 w-10" />
          <span className="font-semibold tracking-tight">
            Nimbus<span className="text-gradient">Desk</span>
          </span>
        </div>

        <ForgotPasswordFlow />

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Lembrou a senha?{" "}
          <Link to="/login" className="text-primary hover:underline font-medium">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}

function ForgotPasswordFlow() {
  const [step, setStep] = useState<"request" | "confirm" | "done">("request");
  const [uid, setUid] = useState("");
  const [token, setToken] = useState("");

  const [email, setEmail] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showNova, setShowNova] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  async function handleRequestSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRequestLoading(true);
    try {
      const data = await requestPasswordReset(email);
      setUid(data.uid);
      setToken(data.token);
      setStep("confirm");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a solicitação");
    } finally {
      setRequestLoading(false);
    }
  }

  async function handleConfirmSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (novaSenha.length < 8) {
      toast.error("A senha deve ter no mínimo 8 caracteres");
      return;
    }
    if (novaSenha !== confirmarSenha) {
      toast.error("As senhas não coincidem");
      return;
    }
    setConfirmLoading(true);
    try {
      await confirmPasswordReset(uid, token, novaSenha);
      setStep("done");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível redefinir a senha");
    } finally {
      setConfirmLoading(false);
    }
  }

  function passwordStrength(pwd: string) {
    if (!pwd) return null;
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { label: "Fraca", color: "bg-destructive", width: "w-1/4" };
    if (score <= 2) return { label: "Regular", color: "bg-warning", width: "w-2/4" };
    if (score <= 3) return { label: "Boa", color: "bg-blue-500", width: "w-3/4" };
    return { label: "Forte", color: "bg-success", width: "w-full" };
  }

  const strength = passwordStrength(novaSenha);

  // ── Done ──
  if (step === "done") {
    return (
      <div className="space-y-5">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="h-14 w-14 rounded-full bg-success/15 grid place-items-center">
            <CheckCircle2 className="h-7 w-7 text-success" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Senha redefinida!</p>
            <p className="text-xs text-muted-foreground mt-1">Sua senha foi alterada com sucesso.</p>
          </div>
        </div>
        <Link
          to="/login"
          className="flex h-10 w-full items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground text-sm font-medium shadow-glow hover:opacity-95 transition"
        >
          Entrar na conta
        </Link>
      </div>
    );
  }

  // ── Confirm ──
  if (step === "confirm") {
    return (
      <div className="space-y-5">
        <div>
          <button
            type="button"
            onClick={() => setStep("request")}
            className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </button>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary/10 grid place-items-center">
              <KeyRound className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">Nova senha</h2>
              <p className="text-xs text-muted-foreground">Código enviado para <span className="text-foreground font-medium">{email}</span></p>
            </div>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleConfirmSubmit}>
          {/* Nova senha */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nova senha</label>
            <div className="relative">
              <input
                type={showNova ? "text" : "password"}
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                className="w-full h-10 rounded-lg bg-muted/40 border border-border pr-10 pl-3 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition"
              />
              <button
                type="button"
                onClick={() => setShowNova((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showNova ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {strength && (
              <div className="space-y-1">
                <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${strength.color} ${strength.width}`} />
                </div>
                <p className={`text-[10px] font-medium ${strength.label === "Fraca" ? "text-destructive" : strength.label === "Regular" ? "text-warning" : strength.label === "Boa" ? "text-blue-400" : "text-success"}`}>
                  Senha {strength.label.toLowerCase()}
                </p>
              </div>
            )}
          </div>

          {/* Confirmar senha */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Confirmar senha</label>
            <div className="relative">
              <input
                type={showConfirmar ? "text" : "password"}
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="Repita a nova senha"
                required
                className={`w-full h-10 rounded-lg bg-muted/40 border pr-10 pl-3 text-sm outline-none focus:ring-2 transition ${
                  confirmarSenha && novaSenha !== confirmarSenha
                    ? "border-destructive/60 focus:border-destructive/60 focus:ring-destructive/20"
                    : "border-border focus:border-primary/60 focus:ring-primary/20"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmar((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showConfirmar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmarSenha && novaSenha !== confirmarSenha && (
              <p className="text-[10px] text-destructive">As senhas não coincidem</p>
            )}
          </div>

          <button
            type="submit"
            disabled={confirmLoading || !novaSenha || !confirmarSenha}
            className="w-full h-10 rounded-lg bg-gradient-primary text-primary-foreground text-sm font-medium shadow-glow inline-flex items-center justify-center gap-1.5 hover:opacity-95 transition disabled:opacity-60"
          >
            {confirmLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Redefinir senha"}
          </button>
        </form>
      </div>
    );
  }

  // ── Request ──
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Esqueci minha senha</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Informe seu e-mail e enviaremos um código de redefinição.
        </p>
      </div>
      <form className="space-y-4" onSubmit={handleRequestSubmit}>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
            autoFocus
            className="w-full h-10 rounded-lg bg-muted/40 border border-border px-3 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition"
          />
        </div>
        <button
          type="submit"
          disabled={requestLoading}
          className="w-full h-10 rounded-lg bg-gradient-primary text-primary-foreground text-sm font-medium shadow-glow inline-flex items-center justify-center gap-1.5 hover:opacity-95 transition disabled:opacity-60"
        >
          {requestLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar código"}
        </button>
      </form>
    </div>
  );
}
