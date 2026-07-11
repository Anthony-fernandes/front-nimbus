import type { ReactNode } from "react";

import { getStoredUser } from "@/services/authService";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";
import type { User } from "@/lib/types";

/**
 * Hook central de permissão: fonte única para esconder ações no frontend.
 * O backend continua sendo a barreira real (403); isto só evita exibir o que
 * o usuário não pode usar.
 */
export function useCan() {
  const user = getStoredUser<User>();
  return {
    user,
    can: (permission: string) => hasPermission(user, permission),
    canAny: (permissions: string[]) => hasAnyPermission(user, permissions),
  };
}

/**
 * Renderiza os filhos apenas se o usuário tiver a permissão exigida.
 * <Can permission="sprints.create"><Button>Nova sprint</Button></Can>
 * Aceita `anyOf` para exigir qualquer uma de uma lista. `fallback` opcional.
 */
export function Can({
  permission,
  anyOf,
  fallback = null,
  children,
}: {
  permission?: string;
  anyOf?: string[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { can, canAny } = useCan();
  const allowed = permission ? can(permission) : anyOf ? canAny(anyOf) : true;
  return <>{allowed ? children : fallback}</>;
}
