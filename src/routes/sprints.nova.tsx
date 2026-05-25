import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/sprints/nova")({
  component: () => <Navigate to="/sprints/new" replace />,
});
