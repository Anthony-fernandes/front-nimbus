import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/projetos/")({
  component: () => <Navigate to="/projects" replace />,
});
