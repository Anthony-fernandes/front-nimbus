import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2, CheckCircle2, Tag, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getStoredUser } from "@/services/authService";
import { api } from "@/services/api";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Configuração inicial · Nimbus" }] }),
  component: OnboardingPage,
});

const DEFAULT_CATEGORIES = [
  { label: "TI", value: "TI" },
  { label: "Infraestrutura", value: "Infraestrutura" },
  { label: "Suporte", value: "Suporte" },
  { label: "Desenvolvimento", value: "Desenvolvimento" },
];

const STEPS = [
  { icon: Building2, label: "Boas-vindas" },
  { icon: Users, label: "Equipe" },
  { icon: Tag, label: "Categorias" },
  { icon: CheckCircle2, label: "Pronto!" },
];

interface TeamMember {
  name: string;
  email: string;
}

function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [companyName, setCompanyName] = useState("");
  const [sector, setSector] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([{ name: "", email: "" }]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    DEFAULT_CATEGORIES.map((c) => c.value),
  );
  const [loading, setLoading] = useState(false);

  const user = getStoredUser();
  const companyId = (user as any)?.company;

  async function handleStep1() {
    if (!companyName && !sector) {
      nextStep();
      return;
    }
    setLoading(true);
    try {
      if (companyId) {
        await api.patch(`/companies/${companyId}/`, {
          ...(companyName ? { name: companyName } : {}),
        });
      }
    } catch {
      // non-blocking
    } finally {
      setLoading(false);
    }
    nextStep();
  }

  async function handleStep2() {
    const validMembers = teamMembers.filter((m) => m.name && m.email);
    if (validMembers.length === 0) {
      nextStep();
      return;
    }
    setLoading(true);
    try {
      await Promise.allSettled(
        validMembers.map((m) =>
          api.post("/users/", { name: m.name, email: m.email, role: "TECHNICIAN" }),
        ),
      );
    } catch {
      // non-blocking
    } finally {
      setLoading(false);
    }
    nextStep();
  }

  async function handleStep3() {
    if (selectedCategories.length === 0) {
      nextStep();
      return;
    }
    setLoading(true);
    try {
      await Promise.allSettled(
        selectedCategories.map((name) =>
          api.post("/ticket-categories/", { name }),
        ),
      );
    } catch {
      // non-blocking
    } finally {
      setLoading(false);
    }
    nextStep();
  }

  function nextStep() {
    setStep((s) => s + 1);
  }

  function prevStep() {
    setStep((s) => s - 1);
  }

  function addMember() {
    setTeamMembers((prev) => [...prev, { name: "", email: "" }]);
  }

  function updateMember(index: number, field: keyof TeamMember, value: string) {
    setTeamMembers((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
    );
  }

  function removeMember(index: number) {
    setTeamMembers((prev) => prev.filter((_, i) => i !== index));
  }

  function toggleCategory(value: string) {
    setSelectedCategories((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value],
    );
  }

  function finish() {
    localStorage.setItem("onboarding_done", "true");
    toast.success("Configuração concluída! Bem-vindo ao Nimbus.");
    void navigate({ to: "/" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        {/* Progress dots */}
        <div className="mb-8 flex items-center justify-center gap-3">
          {STEPS.map((s, i) => (
            <div key={s.label} className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all",
                  i < step
                    ? "bg-primary text-primary-foreground"
                    : i === step
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/30"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 w-8 rounded-full transition-all",
                    i < step ? "bg-primary" : "bg-muted",
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-lg">
          {/* Step 0: Boas-vindas */}
          {step === 0 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold">Boas-vindas!</h1>
                  <p className="text-sm text-muted-foreground">
                    Vamos configurar sua empresa em poucos passos.
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Nome da empresa</label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ex: Acme Corp"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Setor</label>
                  <Input
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    placeholder="Ex: Tecnologia, Saúde, Educação..."
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">
                    Logo (opcional)
                  </label>
                  <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                    Arraste ou clique para fazer upload (JPG, PNG — max 2MB)
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => { nextStep(); }}>
                  Pular
                </Button>
                <Button size="sm" onClick={() => { void handleStep1(); }} disabled={loading}>
                  Próximo
                </Button>
              </div>
            </div>
          )}

          {/* Step 1: Equipe */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold">Convide sua equipe</h1>
                  <p className="text-sm text-muted-foreground">
                    Adicione membros que terão acesso à plataforma.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {teamMembers.map((member, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={member.name}
                      onChange={(e) => updateMember(i, "name", e.target.value)}
                      placeholder="Nome"
                      className="flex-1"
                    />
                    <Input
                      value={member.email}
                      onChange={(e) => updateMember(i, "email", e.target.value)}
                      placeholder="E-mail"
                      type="email"
                      className="flex-1"
                    />
                    {teamMembers.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMember(i)}
                        className="px-2 text-destructive hover:bg-destructive/10"
                      >
                        ×
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addMember} className="w-full">
                  + Adicionar membro
                </Button>
              </div>
              <div className="flex justify-between gap-2">
                <Button variant="ghost" size="sm" onClick={prevStep}>
                  Voltar
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={nextStep}>
                    Pular
                  </Button>
                  <Button size="sm" onClick={() => { void handleStep2(); }} disabled={loading}>
                    Próximo
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Categorias */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10">
                  <Tag className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold">Categorias de chamados</h1>
                  <p className="text-sm text-muted-foreground">
                    Selecione as categorias padrão para sua empresa.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {DEFAULT_CATEGORIES.map((cat) => {
                  const checked = selectedCategories.includes(cat.value);
                  return (
                    <label
                      key={cat.value}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors",
                        checked
                          ? "border-primary/50 bg-primary/10"
                          : "border-border hover:bg-muted/30",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCategory(cat.value)}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="text-sm font-medium">{cat.label}</span>
                    </label>
                  );
                })}
              </div>
              <div className="flex justify-between gap-2">
                <Button variant="ghost" size="sm" onClick={prevStep}>
                  Voltar
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={nextStep}>
                    Pular
                  </Button>
                  <Button size="sm" onClick={() => { void handleStep3(); }} disabled={loading}>
                    Próximo
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Pronto! */}
          {step === 3 && (
            <div className="space-y-5 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-500/15">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold">Tudo pronto!</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sua empresa está configurada. Explore o painel para gerenciar chamados, atividades e muito mais.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-4 text-left text-sm space-y-1">
                {companyName && (
                  <p><span className="text-muted-foreground">Empresa:</span> <strong>{companyName}</strong></p>
                )}
                {sector && (
                  <p><span className="text-muted-foreground">Setor:</span> <strong>{sector}</strong></p>
                )}
                {teamMembers.filter((m) => m.email).length > 0 && (
                  <p>
                    <span className="text-muted-foreground">Membros convidados:</span>{" "}
                    <strong>{teamMembers.filter((m) => m.email).length}</strong>
                  </p>
                )}
                {selectedCategories.length > 0 && (
                  <p>
                    <span className="text-muted-foreground">Categorias criadas:</span>{" "}
                    <strong>{selectedCategories.join(", ")}</strong>
                  </p>
                )}
              </div>
              <Button
                className="w-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md hover:opacity-90"
                onClick={finish}
              >
                Ir para o painel
              </Button>
            </div>
          )}
        </div>

        {/* Step label */}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Etapa {step + 1} de {STEPS.length} — {STEPS[step]?.label}
        </p>
      </div>
    </div>
  );
}
