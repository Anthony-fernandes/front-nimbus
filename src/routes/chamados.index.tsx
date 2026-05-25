import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/chamados/")({
  component: () => <Navigate to="/tickets" replace />,
});
