import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { getHomeRoute } from "@/lib/auth";
import { login } from "@/services/authService";

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

  return (
    <form
      className="mt-6 space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setLoading(true);
        try {
          const session = await login(username, password);
          toast.success("Login realizado com sucesso");
          navigate({ to: getHomeRoute(session.user) });
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
