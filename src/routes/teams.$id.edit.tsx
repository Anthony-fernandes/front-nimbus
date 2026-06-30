import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/app/AppShell";
import { MemberForm } from "@/components/forms/MemberForm";
import { PageHeader } from "@/components/app/PageHeader";
import { getUser, toMemberFormData } from "@/services/userService";

export const Route = createFileRoute("/teams/$id/edit")({
  head: () => ({ meta: [{ title: "Editar usuário · Stratos Suite" }] }),
  component: EditMember,
});

function EditMember() {
  const { id } = Route.useParams();
  const { data: member, isLoading, isError } = useQuery({
    queryKey: ["user", id],
    queryFn: () => getUser(id),
  });

  return (
    <AppShell>
      <div className="max-w-7xl space-y-5">
        <PageHeader
          crumbs={[
            { label: "Usuários", to: "/teams" },
            { label: id, to: `/teams/${id}` },
            { label: "Editar" },
          ]}
          title="Editar usuário"
        />
        {isLoading && (
          <div className="rounded-2xl p-6 text-sm text-muted-foreground glass">
            Carregando usuário...
          </div>
        )}
        {isError && (
          <div className="rounded-2xl p-6 text-sm text-destructive glass">
            Não foi possível carregar o usuário.
          </div>
        )}
        {member && (
          <MemberForm
            mode="edit"
            entityId={id}
            onCancelHref={`/teams/${id}`}
            initial={toMemberFormData(member)}
          />
        )}
      </div>
    </AppShell>
  );
}
