import { useState, FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Save } from "lucide-react";

import { saveClient } from "@/services/clientService";
import { Field, FormSection } from "@/components/app/Field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ClientFormData = {
  name: string;
  doc: string;
  email: string;
  phone: string;
  sector: string;
  owner: string;
  address: string;
  notes: string;
  status: string;
};

const empty: ClientFormData = {
  name: "",
  doc: "",
  email: "",
  phone: "",
  sector: "",
  owner: "",
  address: "",
  notes: "",
  status: "Ativo",
};

export function ClientForm({
  initial,
  mode = "create",
  onCancelHref = "/clients",
  entityId,
}: {
  initial?: Partial<ClientFormData>;
  mode?: "create" | "edit";
  onCancelHref?: string;
  entityId?: string;
}) {
  const navigate = useNavigate();
  const [data, setData] = useState<ClientFormData>({ ...empty, ...initial });

  const set = <K extends keyof ClientFormData>(key: K, value: ClientFormData[K]) =>
    setData((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!data.name.trim() || !data.email.trim()) {
      toast.error("Nome e email são obrigatórios");
      return;
    }

    try {
      await saveClient(data, mode, entityId);
      toast.success(mode === "create" ? "Cliente cadastrado" : "Cliente atualizado");
      navigate({ to: onCancelHref });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar cliente");
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-5">
        <FormSection title="Identificação">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Nome / Razão social" required>
              <Input value={data.name} onChange={(event) => set("name", event.target.value)} required />
            </Field>
            <Field label="CNPJ / CPF">
              <Input value={data.doc} onChange={(event) => set("doc", event.target.value)} placeholder="00.000.000/0000-00" />
            </Field>
            <Field label="Email" required>
              <Input type="email" value={data.email} onChange={(event) => set("email", event.target.value)} required />
            </Field>
            <Field label="Telefone">
              <Input value={data.phone} onChange={(event) => set("phone", event.target.value)} placeholder="(11) 90000-0000" />
            </Field>
            <Field label="Setor">
              <Sel value={data.sector} onChange={(value) => set("sector", value)} options={["Tecnologia", "Financeiro", "Saúde", "Indústria", "Varejo", "Educação", "Outro"]} />
            </Field>
            <Field label="Contato principal">
              <Input value={data.owner} onChange={(event) => set("owner", event.target.value)} placeholder="Nome do contato" />
            </Field>
            <Field label="Status">
              <Sel value={data.status} onChange={(value) => set("status", value)} options={["Ativo", "Prospect", "Inativo", "Bloqueado"]} />
            </Field>
          </div>
        </FormSection>
        <FormSection title="Endereço e observações">
          <Field label="Endereço">
            <Input value={data.address} onChange={(event) => set("address", event.target.value)} placeholder="Rua, número, cidade, UF" />
          </Field>
          <Field label="Observações">
            <Textarea value={data.notes} onChange={(event) => set("notes", event.target.value)} rows={5} />
          </Field>
        </FormSection>
      </div>
      <div className="space-y-5">
        <div className="sticky top-20 flex flex-col gap-2 glass rounded-2xl p-3 shadow-card">
          <Button type="submit" className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow w-full gap-1.5">
            <Save className="h-4 w-4" /> {mode === "create" ? "Cadastrar cliente" : "Salvar alterações"}
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
