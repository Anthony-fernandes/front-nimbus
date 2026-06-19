import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Loader2, Copy, Check } from "lucide-react";
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
      <div className="w-full max-w-sm glass-strong rounded-2xl p-7 shadow-card animate-fade-in-up">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="font-semibold">
            Nimbus<span className="text-gradient">Desk</span>
          </div>
        </div>
        <h2 className="text-xl font-semibold tracking-tight">Redefinir senha</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Informe seu e-mail para receber os dados de redefinição
        </p>
        <ForgotPasswordFlow />
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Lembrou a senha?{" "}
          <Link to="/login" className="text-primary hover:underline">
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
  const [copied, setCopied] = useState(false);

  const [email, setEmail] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);

  const [tokenInput, setTokenInput] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [confirmLoading, setConfirmLoading] = useState(false);

  async function handleRequestSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRequestLoading(true);
    try {
      const data = await requestPasswordReset(email);
      setUid(data.uid);
      setToken(data.token);
      setTokenInput(data.token);
      setStep("confirm");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a solicitação");
    } finally {
      setRequestLoading(false);
    }
  }

  async function handleConfirmSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (novaSenha !== confirmarSenha) {
      toast.error("As senhas não coincidem");
      return;
    }
    setConfirmLoading(true);
    try {
      await confirmPasswordReset(uid, tokenInput, novaSenha);
      setStep("done");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível redefinir a senha");
    } finally {
      setConfirmLoading(false);
    }
  }

  function handleCopy() {
    const text = `uid: ${uid}\ntoken: ${token}`;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (step === "done") {
    return (
      <div className="mt-6 rounded-lg border border-success/40 bg-success/10 px-4 py-4 text-center space-y-3">
        <p className="text-sm font-medium text-success">Senha redefinida com sucesso!</p>
        <Link
          to="/login"
          className="inline-block text-sm text-primary hover:underline font-medium"
        >
          Faça login
        </Link>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="mt-6 space-y-4">
        {/* Success panel with uid+token */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 space-y-2">
          <p className="text-xs font-medium text-primary">Use os dados abaixo para redefinir a senha</p>
          <div className="font-mono text-xs bg-muted/40 rounded p-2 break-all text-foreground">
            <div><span className="text-muted-foreground">uid:</span> {uid}</div>
            <div><span className="text-muted-foreground">token:</span> {token}</div>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copiado!" : "Copiar"}
          </button>
        </div>

        {/* Confirm form */}
        <form className="space-y-3" onSubmit={handleConfirmSubmit}>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Token</span>
            <input
              type="text"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Token de redefinição"
              required
              className="mt-1 w-full h-10 rounded-lg bg-muted/40 border border-border px-3 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Nova senha</span>
            <input
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="mt-1 w-full h-10 rounded-lg bg-muted/40 border border-border px-3 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Confirmar senha</span>
            <input
              type="password"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="mt-1 w-full h-10 rounded-lg bg-muted/40 border border-border px-3 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition"
            />
          </label>
          <button
            type="submit"
            disabled={confirmLoading}
            className="w-full h-10 rounded-lg bg-gradient-primary text-primary-foreground text-sm font-medium shadow-glow inline-flex items-center justify-center gap-1.5 hover:opacity-95 transition disabled:opacity-60"
          >
            {confirmLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Redefinir senha"}
          </button>
        </form>
      </div>
    );
  }

  // step === "request"
  return (
    <form className="mt-6 space-y-3" onSubmit={handleRequestSubmit}>
      <label className="block">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">E-mail</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          required
          className="mt-1 w-full h-10 rounded-lg bg-muted/40 border border-border px-3 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition"
        />
      </label>
      <button
        type="submit"
        disabled={requestLoading}
        className="w-full h-10 rounded-lg bg-gradient-primary text-primary-foreground text-sm font-medium shadow-glow inline-flex items-center justify-center gap-1.5 hover:opacity-95 transition disabled:opacity-60"
      >
        {requestLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Solicitar redefinição"}
      </button>
    </form>
  );
}
