import { createFileRoute } from "@tanstack/react-router";

import { DashboardHome } from "@/components/dashboard-builder/DashboardHome";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard - Stratos Suite" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  return <DashboardHome screen="viewer" />;
}
