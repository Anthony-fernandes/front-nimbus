import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Award, CheckCircle2, MessageSquare, Star, TrendingUp } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { cn } from "@/lib/utils";
import { getForumUserProfile, listUserBadges } from "@/services/knowledgeService";

export const Route = createFileRoute("/forum/users/$id")({
  head: () => ({ meta: [{ title: "Perfil · Fórum · Stratos Suite" }] }),
  component: ForumUserProfilePage,
});

function fmtDate(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Star; label: string; value: number; color: string }) {
  return (
    <div className="glass rounded-2xl p-4 flex items-center gap-3">
      <div className={cn("h-10 w-10 rounded-xl grid place-items-center shrink-0", color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function ReputationBadge({ score }: { score: number }) {
  const tier =
    score >= 1000 ? { label: "Expert", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" } :
    score >= 500 ? { label: "Avançado", color: "text-purple-400 bg-purple-400/10 border-purple-400/20" } :
    score >= 100 ? { label: "Colaborador", color: "text-blue-400 bg-blue-400/10 border-blue-400/20" } :
    { label: "Iniciante", color: "text-muted-foreground bg-muted/40 border-border/50" };

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold", tier.color)}>
      <Award className="h-3 w-3" />
      {tier.label} · {score} pts
    </span>
  );
}

function ForumUserProfilePage() {
  const { id } = Route.useParams();

  const profileQ = useQuery({
    queryKey: ["forum-user-profile", id],
    queryFn: () => getForumUserProfile(id),
  });

  const badgesQ = useQuery({
    queryKey: ["user-badges", id],
    queryFn: () => listUserBadges(id),
  });

  const profile = profileQ.data;
  const badges = badgesQ.data ?? [];

  return (
    <AppShell>
      <div className="max-w-3xl space-y-6">
        {/* Back */}
        <Link to="/forum" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao Fórum
        </Link>

        {profileQ.isLoading ? (
          <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">Carregando perfil...</div>
        ) : !profile ? (
          <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">Perfil não encontrado.</div>
        ) : (
          <>
            {/* Profile header */}
            <div className="glass rounded-2xl p-6 flex flex-wrap items-center gap-5">
              <div className="h-16 w-16 rounded-2xl bg-gradient-primary grid place-items-center text-primary-foreground text-2xl font-bold shrink-0">
                {profile.full_name ? profile.full_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() : profile.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-semibold">{profile.full_name || profile.username}</h1>
                {profile.job_title && <p className="text-sm text-muted-foreground">{profile.job_title}</p>}
                <div className="mt-2">
                  <ReputationBadge score={profile.reputation} />
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={TrendingUp} label="Reputação" value={profile.reputation} color="bg-yellow-400/10 text-yellow-400" />
              <StatCard icon={MessageSquare} label="Perguntas" value={profile.topics_count} color="bg-blue-400/10 text-blue-400" />
              <StatCard icon={MessageSquare} label="Respostas" value={profile.replies_count} color="bg-purple-400/10 text-purple-400" />
              <StatCard icon={CheckCircle2} label="Melhores respostas" value={profile.best_answers} color="bg-green-500/10 text-green-500" />
            </div>

            {/* Recent topics */}
            {profile.recent_topics.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Perguntas recentes</h2>
                <div className="divide-y divide-border/40 border border-border/50 rounded-2xl overflow-hidden bg-card/30">
                  {profile.recent_topics.map((topic) => (
                    <Link
                      key={topic.id}
                      to="/forum/$id"
                      params={{ id: topic.id }}
                      className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-muted/20 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-1">{topic.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{topic.content?.replace(/[#*`]/g, "").slice(0, 80)}</p>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground shrink-0">
                        <span>{topic.replies_count ?? 0} resp.</span>
                        <span>{fmtDate(topic.created_at)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Badges */}
            {badges.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Conquistas</h2>
                <div className="flex flex-wrap gap-2">
                  {badges.map((ub) => (
                    <div
                      key={ub.id}
                      className="glass rounded-xl px-3 py-2 flex items-center gap-2"
                      title={ub.badge_description}
                    >
                      <Award className="h-4 w-4 text-yellow-400 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold">{ub.badge_name}</p>
                        <p className="text-[10px] text-muted-foreground">{ub.badge_description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent replies */}
            {profile.recent_replies.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Respostas recentes</h2>
                <div className="divide-y divide-border/40 border border-border/50 rounded-2xl overflow-hidden bg-card/30">
                  {profile.recent_replies.map((reply) => (
                    <Link
                      key={reply.id}
                      to="/forum/$id"
                      params={{ id: (reply as unknown as { topic: string }).topic }}
                      className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-muted/20 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground mb-0.5">Resposta</p>
                        <p className="text-sm line-clamp-2 text-muted-foreground group-hover:text-foreground transition-colors">
                          {reply.content?.replace(/[#*`]/g, "").slice(0, 120)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground shrink-0">
                        {reply.is_best_answer && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                        <span>{fmtDate(reply.created_at)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
