import { Outlet, createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Organization } from "@/lib/types";
import { listOrganizations } from "@/services/clientService";

export const Route = createFileRoute("/clients")({
  head: () => ({ meta: [{ title: "Organizacoes · NimbusDesk" }] }),
  component: OrganizationsPage,
});

const healthClr: Record<string, string> = {
  Otimo: "bg-success/15 text-success",
  Bom: "bg-info/15 text-info",
  Atencao: "bg-warning/15 text-warning",
};

function money(value?: string | number) {
  const amount = Number(value ?? 0);
  return amount
    ? amount.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        notation: "compact",
      })
    : "R$ 0";
}

function OrganizationsPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { data: organizations = [], isLoading, isError } = useQuery({
    queryKey: ["clients"],
    queryFn: () => listOrganizations(),
  });

  if (pathname !== "/clients") {
    return <Outlet />;
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Organizacoes</h1>
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Carregando organizacoes..." : `${organizations.length} organizacoes cadastradas`}
            </p>
          </div>
          <Button
            asChild
            className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
          >
            <Link to="/clients/new">
              <Plus className="h-4 w-4" /> Nova organizacao
            </Link>
          </Button>
        </div>

        {isError ? (
          <div className="glass rounded-2xl p-4 text-sm text-destructive">
            Nao foi possivel carregar as organizacoes.
          </div>
        ) : null}

        {!isLoading && organizations.length === 0 ? (
          <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">
            Nenhuma organizacao cadastrada.
          </div>
        ) : null}

        <div className="glass overflow-hidden rounded-2xl shadow-card">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground hover:bg-transparent">
                <TableHead className="px-4 py-2.5">Organizacao</TableHead>
                <TableHead className="px-2 py-2.5">Contato</TableHead>
                <TableHead className="px-2 py-2.5">Tipo</TableHead>
                <TableHead className="px-2 py-2.5">Saude</TableHead>
                <TableHead className="px-2 py-2.5">Chamados</TableHead>
                <TableHead className="px-2 py-2.5">Status</TableHead>
                <TableHead className="px-4 py-2.5 text-right">MRR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map((organization: Organization) => (
                <TableRow key={organization.id} className="border-border hover:bg-muted/30">
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary text-sm font-semibold text-primary-foreground">
                        {organization.name
                          .split(" ")
                          .map((segment) => segment[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                      <div className="min-w-0">
                        <Link
                          to="/clients/$id"
                          params={{ id: organization.id }}
                          className="truncate font-medium hover:text-primary"
                        >
                          {organization.name}
                        </Link>
                        <div className="text-[11px] text-muted-foreground">
                          {organization.sector || organization.organization_type || organization.type || "Sem classificacao"}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-2 py-3 text-muted-foreground">
                    <div>{organization.contact_name || "Nao informado"}</div>
                    <div className="text-[11px]">{organization.email || organization.phone || "-"}</div>
                  </TableCell>
                  <TableCell className="px-2 py-3">
                    {organization.organization_type || organization.type || "Organizacao"}
                  </TableCell>
                  <TableCell className="px-2 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        healthClr[organization.health || "Bom"] || "bg-muted text-muted-foreground"
                      }`}
                    >
                      {organization.health || "Bom"}
                    </span>
                  </TableCell>
                  <TableCell className="px-2 py-3 font-medium">{organization.tickets ?? 0}</TableCell>
                  <TableCell className="px-2 py-3">
                    <span className="rounded-md bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
                      {organization.status || "Ativo"}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right font-medium">
                    {money(organization.mrr)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppShell>
  );
}
