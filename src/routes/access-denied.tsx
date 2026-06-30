import { createFileRoute, Link } from "@tanstack/react-router";

import { getHomeRoute } from "@/lib/auth";
import { getStoredUser } from "@/services/authService";

export const Route = createFileRoute("/access-denied")({
  head: () => ({ meta: [{ title: "Acesso negado · NimbusDesk" }] }),
  component: AccessDeniedPage,
});

function AccessDeniedPage() {
  const user = getStoredUser();
  const homeRoute = getHomeRoute(user);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="glass-strong max-w-md rounded-2xl p-8 text-center shadow-card">
        <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
          Acesso negado
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Você não tem permissão para acessar esta área
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O portal continua protegido por tipo de usuário e pelas permissões finais resolvidas para a sua conta.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            to={homeRoute}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir para meu portal
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Trocar usuário
          </Link>
        </div>
      </div>
    </div>
  );
}
