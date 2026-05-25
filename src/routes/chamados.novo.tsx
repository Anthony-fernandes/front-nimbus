import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/chamados/novo")({
  component: () => <Navigate to="/tickets/new" replace />,
});
