import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/chamados/$id/editar")({
  component: RedirectComp,
});

function RedirectComp() {
  const { id } = Route.useParams();
  return <Navigate to="/tickets/$id/edit" params={{ id }} replace />;
}
