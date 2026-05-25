import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/projetos/novo")({
  component: () => <Navigate to="/projects/new" replace />,
});
