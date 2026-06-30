import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { MemberForm } from "@/components/forms/MemberForm";

export const Route = createFileRoute("/teams/new")({
  head: () => ({ meta: [{ title: "Novo usuário · Stratos Suite" }] }),
  component: () => (
    <AppShell>
      <div className="max-w-7xl space-y-5">
        <PageHeader
          crumbs={[{ label: "Usuários", to: "/teams" }, { label: "Novo" }]}
          title="Novo usuário"
          subtitle="Cadastre um usuário, defina papel e configure permissões."
        />
        <MemberForm mode="create" />
      </div>
    </AppShell>
  ),
})
