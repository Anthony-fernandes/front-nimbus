import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/sprints/$id/editar")({
  component: RedirectComp,
});

function RedirectComp() {
  const { id } = Route.useParams();
  return <Navigate to="/sprints/$id/edit" params={{ id }} replace />;
}
