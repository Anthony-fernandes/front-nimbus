import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/atividades/$id")({
  component: RedirectComp,
});

function RedirectComp() {
  const { id } = Route.useParams();
  return <Navigate to="/activities/$id" params={{ id }} replace />;
}
