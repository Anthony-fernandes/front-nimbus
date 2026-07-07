import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Clock,
  Eye,
  EyeOff,
  Headset,
  KanbanSquare,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Ticket,
  UserRound,
} from "lucide-react";
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

const FEATURES = [
  {
    icon: Ticket,
    title: "Central de chamados",
    description: "Abertura, triagem, SLA e resolução documentada em um fluxo único.",
  },
  {
    icon: KanbanSquare,
    title: "Projetos, sprints e kanban",
    description: "Atividades, capacidade por técnico e planejamento visual.",
  },
  {
    icon: Clock,
    title: "SLA sob controle",
    description: "Prazos por prioridade, categoria e cliente, com alertas antes do estouro.",
  },
  {
    icon: BarChart3,
    title: "Relatórios e indicadores",
    description: "CSAT, reaberturas, produtividade e exportação para Excel.",
  },
];

function LoginPage() {
  const { reason } = Route.useSearch();
  return (
    <div className="grid min-h-screen w-full bg-background text-foreground lg:grid-cols-[1.1fr_1fr]">
      {/* ── Painel institucional ─────────────────────────────────── */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-border/60 p-10 lg:flex xl:p-14">
        {/* Fundo decorativo */}
        <div className="absolute inset-0 bg-gradient-primary opacity-[0.07]" />
        <div className="absolute -top-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-accent/20 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, color-mix(in oklch, currentColor 12%, transparent) 1px, transparent 0)",
            backgroundSize: "28px 28px",
            color: "var(--muted-foreground, #888)",
          }}
        />

        {/* Marca */}
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-primary shadow-glow">
            <Headset className="h-5.5 w-5.5 h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight">
              Nimbus<span className="text-gradient">Desk</span>
            </div>
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Service Desk &amp; Gestão Operacional
            </div>
          </div>
        </div>

        {/* Mensagem + features */}
        <div className="relative max-w-lg">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
            Toda a operação de suporte da sua equipe em um só lugar.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Chamados, projetos, sprints, SLA e relatórios conectados — do primeiro contato ao
            encerramento com resolução registrada.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-xl border border-border/70 bg-background/50 p-3.5 backdrop-blur transition-colors hover:border-primary/30"
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm font-semibold">{title}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Rodapé institucional */}
        <div className="relative flex items-center justify-between text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} NimbusDesk · Todos os direitos reservados</span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            Conexão segura · Autenticação em duas etapas
          </span>
        </div>
      </div>

      {/* ── Coluna do formulário ─────────────────────────────────── */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[400px]">
          {/* Marca (mobile) */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary shadow-glow">
              <Headset className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-bold leading-tight">
                Nimbus<span className="text-gradient">Desk</span>
              </div>
              <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Service Desk
              </div>
            </div>
          </div>

          <div className="glass-strong rounded-2xl border border-border/70 p-8 shadow-card animate-fade-in-up">
            <h2 className="text-xl font-semibold tracking-tight">Acesse sua central</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Entre com suas credenciais para gerenciar chamados e atividades.
            </p>

            {reason === "timeout" && (
              <div className="mt-4 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
                Sua sessão expirou por inatividade. Por favor, entre novamente.
              </div>
            )}

            <LoginForm />
          </div>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            Problemas para acessar? Fale com o administrador da sua empresa.
          </p>
        </div>
      </div>
    </div>
  );
}

const REMEMBER_KEY = "nimbus_remembered_user";

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-muted/30 pl-10 pr-3 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20";

function LoginForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"credentials" | "mfa" | "forgot">("credentials");
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  // ── Verificação em duas etapas ────────────────────────────────────────────
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
          <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-base font-semibold">Verificação em duas etapas</h3>
          <p className="text-center text-xs text-muted-foreground">
            Digite o código de 6 dígitos do seu aplicativo autenticador
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
            className="h-12 w-44 rounded-lg border border-border bg-muted/30 px-3 text-center text-xl tracking-[0.4em] outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <button
          type="submit"
          disabled={loading || totpCode.length < 6}
          className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-primary text-sm font-medium text-primary-foreground shadow-glow transition hover:opacity-95 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verificar e entrar"}
        </button>

        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setStep("credentials");
              setMfaToken(null);
              setTotpCode("");
            }}
            className="text-xs text-muted-foreground underline underline-offset-2 transition hover:text-foreground"
          >
            Voltar ao login
          </button>
        </div>
      </form>
    );
  }

  // ── Recuperação de senha ──────────────────────────────────────────────────
  if (step === "forgot") {
    return (
      <div className="mt-6 space-y-4">
        <div className="flex flex-col items-center gap-1 pb-1">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-base font-semibold">Recuperar senha</h3>
          <p className="text-center text-xs text-muted-foreground">
            Informe seu e-mail cadastrado para receber o link de redefinição.
          </p>
        </div>

        {forgotSent ? (
          <div className="rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-center text-sm text-success">
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
              <span className="mb-1 block text-xs font-medium">E-mail</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  autoFocus
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="seu@empresa.com"
                  className={inputClass}
                />
              </div>
            </label>
            <button
              type="submit"
              disabled={forgotLoading || !forgotEmail.trim()}
              className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-primary text-sm font-medium text-primary-foreground shadow-glow transition hover:opacity-95 disabled:opacity-60"
            >
              {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar link de recuperação"}
            </button>
          </form>
        )}

        <div className="text-center">
          <button
            type="button"
            onClick={() => { setStep("credentials"); setForgotSent(false); setForgotEmail(""); }}
            className="text-xs text-muted-foreground underline underline-offset-2 transition hover:text-foreground"
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
      className="mt-6 space-y-4"
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
          <span className="mb-1 block text-xs font-medium">Usuário ou e-mail</span>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              {...register("username")}
              type="text"
              autoComplete="username"
              placeholder="usuario ou email@empresa.com"
              className={inputClass}
            />
          </div>
        </label>
        {errors.username && (
          <p className="mt-1 text-xs text-destructive">{errors.username.message}</p>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium">Senha</span>
          <button
            type="button"
            onClick={() => setStep("forgot")}
            className="text-xs text-primary transition hover:underline"
          >
            Esqueci minha senha
          </button>
        </div>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            {...register("password")}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            className={`${inputClass} pr-11`}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      <label className="flex cursor-pointer select-none items-center gap-2">
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
        className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-primary text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-95 disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Entrar na central <ArrowRight className="h-4 w-4" /></>}
      </button>

      <div className="flex items-center justify-center gap-1.5 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-success" />
        Suas credenciais trafegam criptografadas
      </div>
    </form>
  );
}
