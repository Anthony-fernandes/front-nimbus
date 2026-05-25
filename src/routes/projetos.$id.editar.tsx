import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/projetos/$id/editar")({
  component: RedirectComp,
});

function RedirectComp() {
  const { id } = Route.useParams();
  return <Navigate to="/projects/$id/edit" params={{ id }} replace />;
}
