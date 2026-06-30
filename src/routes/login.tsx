import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Sparkles, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type { User } from "@/lib/types";
import { getHomeRoute, normalizeUser } from "@/lib/auth";
import { api } from "@/services/api";
import { setSession } from "@/services/session";
import { parseApiError } from "@/services/utils";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar · NimbusDesk" }] }),
  validateSearch: (search) => ({ reason: (search.reason as string) || "" }),
  component: LoginPage,
});

const loginSchema = z.object({
  username: z.string().min(1, "Usuário obrigatório"),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginPage() {
  const { reason } = Route.useSearch();
  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-background text-foreground">
      <div className="relative hidden lg:flex flex-col justify-between p-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-primary opacity-20" />
        <div className="absolute -top-32 -left-20 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="text-lg font-semibold">
            Nimbus<span className="text-gradient">Desk</span>
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
          © NimbusDesk 2026 · Todos os direitos reservados
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm glass-strong rounded-2xl p-7 shadow-card animate-fade-in-up">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="font-semibold">
              Nimbus<span className="text-gradient">Desk</span>
            </div>
          </div>
          <h2 className="text-xl font-semibold tracking-tight">Entrar na workspace</h2>
          <p className="text-xs text-muted-foreground mt-1">Use seu usuário ou e-mail cadastrado</p>

          {reason === "timeout" && (
            <div className="mt-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
              Sua sessão expirou por inatividade. Por favor, entre novamente.
            </div>
          )}

          <LoginForm />
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

const REMEMBER_KEY = "nimbus_remembered_user";

function LoginForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"credentials" | "mfa" | "forgot">("credentials");
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [rememberMe, setRememberMe] = useState(() => typeof window !== "undefined" && !!localStorage.getItem(REMEMBER_KEY));
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: (typeof window !== "undefined" ? localStorage.getItem(REMEMBER_KEY) : null) || "", password: "" },
  });
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
            toast.error(parseApiError(error, "Código inválido"));
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

  // ── Tela de recuperação de senha ──────────────────────────────────────────
  if (step === "forgot") {
    return (
      <div className="mt-6 space-y-4">
        <div className="flex flex-col items-center gap-1 pb-1">
          <h3 className="text-base font-semibold">Recuperar senha</h3>
          <p className="text-xs text-muted-foreground text-center">
            Informe seu e-mail cadastrado para receber o link de redefinição.
          </p>
        </div>

        {forgotSent ? (
          <div className="rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm text-success text-center">
            E-mail enviado! Verifique sua caixa de entrada.
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!forgotEmail.trim()) return;
              setForgotLoading(true);
              try {
                await api.post("/auth/password-reset/", { email: forgotEmail.trim() });
                setForgotSent(true);
              } catch {
                toast.error("Não foi possível enviar o e-mail. Verifique o endereço informado.");
              } finally {
                setForgotLoading(false);
              }
            }}
          >
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">E-mail</span>
              <input
                type="email"
                autoFocus
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="seu@email.com"
                className="mt-1 w-full h-10 rounded-lg bg-muted/40 border border-border px-3 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition"
              />
            </label>
            <button
              type="submit"
              disabled={forgotLoading || !forgotEmail.trim()}
              className="w-full h-10 rounded-lg bg-gradient-primary text-primary-foreground text-sm font-medium shadow-glow inline-flex items-center justify-center gap-1.5 hover:opacity-95 transition disabled:opacity-60"
            >
              {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar link de recuperação"}
            </button>
          </form>
        )}

        <div className="text-center">
          <button
            type="button"
            onClick={() => { setStep("credentials"); setForgotSent(false); setForgotEmail(""); }}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition"
          >
            Voltar ao login
          </button>
        </div>
      </div>
    );
  }

  // ── Formulário principal ───────────────────────────────────────────────────
  return (
    <form
      className="mt-6 space-y-3"
      onSubmit={handleSubmit(async (values) => {
        const { username, password } = values;
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

          // Lembrar usuário
          if (rememberMe) {
            localStorage.setItem(REMEMBER_KEY, username);
          } else {
            localStorage.removeItem(REMEMBER_KEY);
          }

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
          toast.error(parseApiError(error, "Credenciais inválidas. Tente novamente."));
        } finally {
          setLoading(false);
        }
      })}
    >
      <div>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Usuário ou e-mail</span>
          <input
            {...register("username")}
            type="text"
            autoComplete="username"
            placeholder="usuario ou email@empresa.com"
            className="mt-1 w-full h-10 rounded-lg bg-muted/40 border border-border px-3 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition"
          />
        </label>
        {errors.username && (
          <p className="mt-1 text-xs text-destructive">{errors.username.message}</p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Senha</span>
          <button
            type="button"
            onClick={() => setStep("forgot")}
            className="text-[11px] text-primary hover:underline"
          >
            Esqueci minha senha
          </button>
        </div>
        <input
          {...register("password")}
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          className="w-full h-10 rounded-lg bg-muted/40 border border-border px-3 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition"
        />
        {errors.password && (
          <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        <span className="text-xs text-muted-foreground">Lembrar usuário neste dispositivo</span>
      </label>

      <button
        type="submit"
        disabled={loading}
        className="w-full h-10 rounded-lg bg-gradient-primary text-primary-foreground text-sm font-medium shadow-glow inline-flex items-center justify-center gap-1.5 hover:opacity-95 transition disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Entrar <ArrowRight className="h-4 w-4" /></>}
      </button>
    </form>
  );
}
