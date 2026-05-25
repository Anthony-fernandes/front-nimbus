import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/atividades/nova")({
  component: () => <Navigate to="/activities/new" replace />,
});
