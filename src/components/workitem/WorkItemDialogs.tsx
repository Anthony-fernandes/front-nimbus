import { useState } from "react";
import { AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

/** Confirmação final: a resolução é imutável depois de gravada. */
export function WorkItemFinishDialog({
  open,
  onOpenChange,
  resolutionType,
  saving,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resolutionType: string;
  saving: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" /> Finalizar item
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Deseja realmente finalizar este item como{" "}
          <span className="font-medium text-foreground">{resolutionType}</span>? A resolução será
          registrada no histórico e não poderá ser removida.
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={saving} onClick={onConfirm} className="bg-success text-white hover:bg-success/90">
            {saving ? "Finalizando..." : "Finalizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Reabertura exige motivo — registrado no histórico. */
export function WorkItemReopenDialog({
  open,
  onOpenChange,
  saving,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setReason(""); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-warning" /> Reabrir item
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Informe o motivo da reabertura. Ele será registrado no histórico.
        </p>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Ex.: o problema voltou a ocorrer após a entrega."
          autoFocus
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={saving || !reason.trim()} onClick={() => onConfirm(reason.trim())}>
            {saving ? "Reabrindo..." : "Reabrir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Pausar/Bloquear/Cancelar exigem motivo. */
export function WorkItemBlockDialog({
  open,
  onOpenChange,
  title,
  description,
  actionLabel,
  saving,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  actionLabel: string;
  saving: boolean;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setReason(""); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" /> {title}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{description}</p>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Descreva o motivo..."
          autoFocus
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={saving || !reason.trim()} onClick={() => onConfirm(reason.trim())}>
            {saving ? "Salvando..." : actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
