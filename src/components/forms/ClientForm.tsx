import { FormEvent, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { Field, FormSection } from "@/components/app/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { listOrganizations, saveClient } from "@/services/clientService";
import { parseApiError } from "@/services/utils";

export type ClientFormData = {
  name: string;
  organizationType: string;
  doc: string;
  email: string;
  phone: string;
  sector: string;
  owner: string;
  address: string;
  parentOrganization: string;
  notes: string;
  status: string;
};

const empty: ClientFormData = {
  name: "",
  organizationType: "CLIENTE_EMPRESA",
  doc: "",
  email: "",
  phone: "",
  sector: "",
  owner: "",
  address: "",
  parentOrganization: "",
  notes: "",
  status: "Ativo",
};

const ORGANIZATION_TYPE_OPTIONS = [
  { value: "CLIENTE_EMPRESA", label: "Cliente empresa" },
  { value: "CLIENTE_PESSOA", label: "Cliente pessoa" },
  { value: "EMPRESA_INTERNA", label: "Empresa interna" },
  { value: "SETOR_INTERNO", label: "Setor interno" },
  { value: "DEPARTAMENTO", label: "Departamento" },
  { value: "FILIAL", label: "Filial" },
  { value: "OUTRO", label: "Outro" },
];

const SECTOR_OPTIONS = [
  "Tecnologia",
  "Financeiro",
  "Saude",
  "Industria",
  "Varejo",
  "Educacao",
  "Outro",
];

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
  const { data: organizations = [] } = useQuery({
    queryKey: ["organization-form-options"],
    queryFn: () => listOrganizations(),
  });

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
      toast.success(mode === "create" ? "Organização cadastrada" : "Organização atualizada");
      navigate({ to: onCancelHref });
    } catch (error) {
      toast.error(parseApiError(error, "Erro ao salvar organização"));
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <FormSection
          title="Organização atendida"
          description="Cadastre clientes, áreas internas, setores, departamentos ou filiais atendidas."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome da organização" required>
              <Input
                value={data.name}
                onChange={(event) => set("name", event.target.value)}
                required
              />
            </Field>
            <Field label="Tipo de organização">
              <Selectable
                value={data.organizationType}
                onChange={(value) => set("organizationType", value)}
                options={ORGANIZATION_TYPE_OPTIONS}
              />
            </Field>
            <Field label="Documento">
              <Input
                value={data.doc}
                onChange={(event) => set("doc", event.target.value)}
                placeholder="CPF, CNPJ ou documento interno"
              />
            </Field>
            <Field label="Email" required>
              <Input
                type="email"
                value={data.email}
                onChange={(event) => set("email", event.target.value)}
                required
              />
            </Field>
            <Field label="Telefone">
              <Input
                value={data.phone}
                onChange={(event) => set("phone", event.target.value)}
                placeholder="(11) 90000-0000"
              />
            </Field>
            <Field label="Setor">
              <Selectable
                value={data.sector}
                onChange={(value) => set("sector", value)}
                options={SECTOR_OPTIONS.map((option) => ({ value: option, label: option }))}
              />
            </Field>
            <Field label="Contato principal">
              <Input
                value={data.owner}
                onChange={(event) => set("owner", event.target.value)}
                placeholder="Pessoa de referência"
              />
            </Field>
            <Field
              label="Organização pai"
              hint="Opcional. Use para montar hierarquia entre empresa, filial, área e departamento."
            >
              <Selectable
                value={data.parentOrganization}
                onChange={(value) => set("parentOrganization", value)}
                options={organizations
                  .filter((organization) => organization.id !== entityId)
                  .map((organization) => ({
                    value: organization.id,
                    label: organization.name,
                  }))}
                placeholder="Selecionar organização pai"
                allowEmpty
              />
            </Field>
            <Field label="Status">
              <Selectable
                value={data.status}
                onChange={(value) => set("status", value)}
                options={["Ativo", "Prospect", "Inativo", "Bloqueado"].map((option) => ({
                  value: option,
                  label: option,
                }))}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Endereço e observações">
          <Field label="Endereço">
            <Input
              value={data.address}
              onChange={(event) => set("address", event.target.value)}
              placeholder="Rua, número, cidade, UF"
            />
          </Field>
          <Field label="Observações">
            <Textarea
              value={data.notes}
              onChange={(event) => set("notes", event.target.value)}
              rows={5}
            />
          </Field>
        </FormSection>
      </div>

      <div className="space-y-5">
        <div className="glass sticky top-20 flex flex-col gap-2 rounded-2xl p-3 shadow-card">
          <Button
            type="submit"
            className="w-full gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
          >
            <Save className="h-4 w-4" />
            {mode === "create" ? "Cadastrar organização" : "Salvar alterações"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => navigate({ to: onCancelHref })}
          >
            Cancelar
          </Button>
        </div>
      </div>
    </form>
  );
}

function Selectable({
  value,
  onChange,
  options,
  placeholder,
  allowEmpty = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  return (
    <Select
      value={value || (allowEmpty ? "__none__" : undefined)}
      onValueChange={(nextValue) => onChange(nextValue === "__none__" ? "" : nextValue)}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder || "Selecionar"} />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty ? <SelectItem value="__none__">Nenhuma</SelectItem> : null}
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
