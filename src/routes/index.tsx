import { createFileRoute } from "@tanstack/react-router";

import { DashboardHome } from "@/components/dashboard-builder/DashboardHome";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard - NimbusDesk" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  return <DashboardHome screen="viewer" />;
}
