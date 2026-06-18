import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Sparkles, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { User } from "@/lib/types";
import { getHomeRoute, normalizeUser } from "@/lib/auth";
import { api } from "@/services/api";
import { setSession } from "@/services/session";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar · Stratos Suite" }] }),
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="dark min-h-screen w-full grid lg:grid-cols-2 bg-background text-foreground">
      <div className="relative hidden lg:flex flex-col justify-between p-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-primary opacity-20" />
        <div className="absolute -top-32 -left-20 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="text-lg font-semibold">
            Stratos<span className="text-gradient">Suite</span>
          </div>
        </div>
        <div className="relative">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight max-w-md">
            A operacao da sua equipe tecnica conectada ao backend Django.
          </h1>
          <p className="mt-4 text-muted-foreground max-w-md">
            Chamados, projetos, sprints e atividades em um unico fluxo.
          </p>
          <div className="mt-8 flex gap-2">
            {["Django API", "JWT", "React", "Vite"].map((tag) => (
              <span key={tag} className="text-[11px] px-2.5 py-1 rounded-full glass">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-muted-foreground">
          © Stratos Suite 2026 · Todos os direitos reservados
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm glass-strong rounded-2xl p-7 shadow-card animate-fade-in-up">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="font-semibold">
              Stratos<span className="text-gradient">Suite</span>
            </div>
          </div>
          <h2 className="text-xl font-semibold tracking-tight">Entrar na workspace</h2>
          <p className="text-xs text-muted-foreground mt-1">Use seu usuário ou e-mail cadastrado</p>

          <LoginForm />

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Backend local pronto?{" "}
            <Link to="/" className="text-primary hover:underline">
              Abrir dashboard
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        placeholder={placeholder}
        className="mt-1 w-full h-10 rounded-lg bg-muted/40 border border-border px-3 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition"
      />
    </label>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"credentials" | "mfa">("credentials");
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  if (step === "mfa") {
    return (
      <form
        className="mt-6 space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!mfaToken) return;
          setLoading(true);
          try {
            const response = await api.post<{ access: string; refresh: string; user?: User | null }>(
              "/auth/mfa/verify-login/",
              { mfa_token: mfaToken, totp_code: totpCode },
            );
            setSession({ access: response.data.access, refresh: response.data.refresh, user: null });
            const user =
              normalizeUser(response.data.user) ||
              normalizeUser((await api.get<User>("/auth/me/")).data);
            const session = { ...response.data, user };
            setSession(session);
            toast.success("Login realizado com sucesso");
            navigate({ to: getHomeRoute(user) });
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Código inválido");
          } finally {
            setLoading(false);
          }
        }}
      >
        <div className="flex flex-col items-center gap-2 pb-2">
          <div className="h-12 w-12 rounded-full bg-primary/10 grid place-items-center">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-base font-semibold">Verificação em dois fatores</h3>
          <p className="text-xs text-muted-foreground text-center">
            Digite o código do seu aplicativo autenticador
          </p>
        </div>

        <div className="flex justify-center">
          <input
            autoFocus
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="w-40 h-12 rounded-lg bg-muted/40 border border-border px-3 text-center text-xl tracking-[0.4em] outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition"
          />
        </div>

        <button
          type="submit"
          disabled={loading || totpCode.length < 6}
          className="w-full h-10 rounded-lg bg-gradient-primary text-primary-foreground text-sm font-medium shadow-glow inline-flex items-center justify-center gap-1.5 hover:opacity-95 transition disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verificar"}
        </button>

        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setStep("credentials");
              setMfaToken(null);
              setTotpCode("");
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition underline underline-offset-2"
          >
            Voltar ao login
          </button>
        </div>
      </form>
    );
  }

  return (
    <form
      className="mt-6 space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setLoading(true);
        try {
          const response = await api.post<
            | { access: string; refresh: string; user?: unknown }
            | { mfa_required: true; mfa_token: string }
          >("/auth/login/", { username, password });

          if ("mfa_required" in response.data && response.data.mfa_required) {
            setMfaToken(response.data.mfa_token);
            setStep("mfa");
            setTotpCode("");
            return;
          }

          const data = response.data as { access: string; refresh: string; user?: User | null };
          setSession({ access: data.access, refresh: data.refresh, user: null });

          try {
            const user =
              normalizeUser(data.user) ||
              normalizeUser((await api.get<User>("/auth/me/")).data);
            const session = { ...data, user };
            setSession(session);
            toast.success("Login realizado com sucesso");
            navigate({ to: getHomeRoute(user) });
          } catch (error) {
            const { clearSession } = await import("@/services/session");
            clearSession();
            throw error;
          }
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Não foi possível entrar");
        } finally {
          setLoading(false);
        }
      }}
    >
      <Field label="Usuário ou e-mail" type="text" placeholder="admin" value={username} onChange={setUsername} />
      <Field label="Senha" type="password" placeholder="••••••••" value={password} onChange={setPassword} />
      <button
        type="submit"
        disabled={loading}
        className="w-full h-10 rounded-lg bg-gradient-primary text-primary-foreground text-sm font-medium shadow-glow inline-flex items-center justify-center gap-1.5 hover:opacity-95 transition disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Entrar <ArrowRight className="h-4 w-4" /></>}
      </button>
      <p className="text-[11px] text-muted-foreground text-center">Demo local do backend: admin / admin123</p>
    </form>
  );
}
