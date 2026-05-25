import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ClientScopeNotice({
  title = "Conta do cliente não vinculada",
  description = "Vincule este usuário a uma conta de cliente para liberar o portal.",
  actionHref,
  actionLabel,
}: {
  title?: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="glass rounded-2xl p-6 shadow-card">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-warning/15 p-2 text-warning">
          <AlertCircle className="h-4 w-4" />
        </div>
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          {actionHref && actionLabel && (
            <Button asChild variant="outline">
              <a href={actionHref}>{actionLabel}</a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
