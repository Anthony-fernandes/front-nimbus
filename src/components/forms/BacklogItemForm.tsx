import { useState, FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Save } from "lucide-react";

import { saveActivity } from "@/services/activityService";
import { Field, FormSection } from "@/components/app/Field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseApiError } from "@/services/utils";

export function BacklogItemForm({ onCancelHref = "/backlog" }: { onCancelHref?: string }) {
  const navigate = useNavigate();
  const [data, setData] = useState({
    title: "",
    epic: "",
    type: "História",
    priority: "Média",
    sp: "",
    description: "",
    acceptance: "",
  });

  const set = (key: keyof typeof data, value: string) => setData((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!data.title.trim()) {
      toast.error("Informe o título");
      return;
    }

    try {
      const sections = [
        data.description.trim(),
        data.epic.trim() ? `Epic sugerido: ${data.epic.trim()}` : "",
        data.acceptance.trim()
          ? `Criterios de aceite:\n${data.acceptance.trim()}`
          : "",
        data.sp.trim() ? `Story points sugeridos: ${data.sp.trim()}` : "",
      ].filter(Boolean);

      await saveActivity(
        {
          title: data.title,
          description: sections.join("\n\n"),
          type: data.type,
          status: "Backlog",
          priority: data.priority,
          calculateHourlyCost: false,
          assignee: "",
          project: "",
          ticket: "",
          estHours: "",
          tagIds: [],
          legacyTagNames: [],
          linkTicketOnSave: false,
        },
        "create",
      );
      toast.success("Item adicionado ao backlog");
      navigate({ to: onCancelHref });
    } catch (error) {
      toast.error(parseApiError(error, "Erro ao salvar item"));
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-5">
        <FormSection title="Item de backlog">
          <Field label="Título" required><Input value={data.title} onChange={(event) => set("title", event.target.value)} required maxLength={140} /></Field>
          <Field label="Descrição"><Textarea value={data.description} onChange={(event) => set("description", event.target.value)} rows={5} /></Field>
          <Field label="Critérios de aceite" hint="Use uma linha por critério."><Textarea value={data.acceptance} onChange={(event) => set("acceptance", event.target.value)} rows={4} /></Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Épico"><Input value={data.epic} onChange={(event) => set("epic", event.target.value)} placeholder="Ex.: Autenticação" /></Field>
            <Field label="Tipo"><Sel value={data.type} onChange={(value) => set("type", value)} options={["História", "Tarefa", "Bug", "Spike", "Epic"]} /></Field>
            <Field label="Prioridade"><Sel value={data.priority} onChange={(value) => set("priority", value)} options={["Crítica", "Alta", "Média", "Baixa"]} /></Field>
            <Field label="Story points sugeridos"><Input type="number" min={0} value={data.sp} onChange={(event) => set("sp", event.target.value)} /></Field>
          </div>
        </FormSection>
      </div>
      <div className="space-y-5">
        <div className="sticky top-20 flex flex-col gap-2 glass rounded-2xl p-3 shadow-card">
          <Button type="submit" className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow w-full gap-1.5">
            <Save className="h-4 w-4" /> Adicionar ao backlog
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={() => navigate({ to: onCancelHref })}>
            Cancelar
          </Button>
        </div>
      </div>
    </form>
  );
}

function Sel({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
      <SelectContent>{options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
    </Select>
  );
}
