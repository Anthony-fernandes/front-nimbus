import { createFileRoute } from "@tanstack/react-router";

import { DashboardHome } from "@/components/dashboard-builder/DashboardHome";

export const Route = createFileRoute("/dashboard-builder")({
  head: () => ({ meta: [{ title: "Editor de dashboards - Stratos Suite" }] }),
  component: DashboardBuilderPage,
});

function DashboardBuilderPage() {
  return <DashboardHome screen="builder" />;
}
