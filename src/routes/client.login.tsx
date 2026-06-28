import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import type { User } from "@/lib/types";
import { normalizeUser, normalizeUserRole } from "@/lib/auth";
import { api } from "@/services/api";
import { setSession } from "@/services/session";
import { parseApiError } from "@/services/utils";

export const Route = createFileRoute("/client/login")({
  head: () => ({ meta: [{ title: "Portal do cliente · Entrar · NimbusDesk" }] }),
  component: ClientLoginPage,
});

const loginSchema = z.object({
  username: z.string().min(1, "Usuário obrigatório"),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function ClientLoginPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground p-6">
      <div className="w-full max-w-sm glass-strong rounded-2xl p-7 shadow-card animate-fade-in-up space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-12 w-12 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <div className="text-lg font-semibold">
              Nimbus<span className="text-gradient">Desk</span>
            </div>
            <h2 className="mt-1 text-base font-semibold tracking-tight">Portal do Cliente</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Acesse sua conta para acompanhar seus chamados
            </p>
          </div>
        </div>

        <ClientLoginForm />

        <div className="pt-2 text-center">
          <Link
            to="/login"
            className="text-xs text-muted-foreground hover:text-foreground transition underline underline-offset-2"
          >
            Voltar ao login corporativo
          </Link>
        </div>
      </div>
    </div>
  );
}

function ClientLoginForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"credentials" | "mfa">("credentials");
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [accessError, setAccessError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  if (step === "mfa") {
    return (
      <form
        className="space-y-4"
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
            if (normalizeUserRole(user?.role) !== "CLIENT") {
              const { clearSession } = await import("@/services/session");
              clearSession();
              setStep("credentials");
              setMfaToken(null);
              setTotpCode("");
              setAccessError("Acesso restrito ao portal do cliente.");
              return;
            }
            setSession({ ...response.data, user });
            toast.success("Login realizado com sucesso");
            navigate({ to: "/client" });
          } catch (error) {
            toast.error(parseApiError(error, "Código inválido"));
          } finally {
            setLoading(false);
          }
        }}
      >
        <div className="flex flex-col items-center gap-2">
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
      className="space-y-3"
      onSubmit={handleSubmit(async (values) => {
        setAccessError(null);
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

          try {
            const user =
              normalizeUser(data.user) ||
              normalizeUser((await api.get<User>("/auth/me/")).data);

            if (normalizeUserRole(user?.role) !== "CLIENT") {
              const { clearSession } = await import("@/services/session");
              clearSession();
              setAccessError("Acesso restrito ao portal do cliente.");
              return;
            }

            setSession({ ...data, user });
            toast.success("Login realizado com sucesso");
            navigate({ to: "/client" });
          } catch (error) {
            const { clearSession } = await import("@/services/session");
            clearSession();
            throw error;
          }
        } catch (error) {
          if (!accessError) {
            toast.error(parseApiError(error, "Não foi possível entrar"));
          }
        } finally {
          setLoading(false);
        }
      })}
    >
      {accessError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {accessError}
        </div>
      )}

      <div>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">E-mail ou usuário</span>
          <input
            {...register("username")}
            type="text"
            placeholder="seu@email.com"
            className="mt-1 w-full h-10 rounded-lg bg-muted/40 border border-border px-3 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition"
          />
        </label>
        {errors.username && (
          <p className="mt-1 text-xs text-destructive">{errors.username.message}</p>
        )}
      </div>

      <div>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Senha</span>
          <input
            {...register("password")}
            type="password"
            placeholder="••••••••"
            className="mt-1 w-full h-10 rounded-lg bg-muted/40 border border-border px-3 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition"
          />
        </label>
        {errors.password && (
          <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

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
