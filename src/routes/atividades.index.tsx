import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/atividades/")({
  component: () => <Navigate to="/activities" replace />,
});
