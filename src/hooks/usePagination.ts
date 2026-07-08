import { useEffect, useMemo, useState } from "react";

/**
 * Paginação client-side padronizada. Passe as linhas já filtradas e um
 * "resetKey" (string derivada dos filtros) — mudar filtros volta à página 1.
 */
export function usePagination<T>(rows: T[], resetKey: string, initialPageSize = 25) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => rows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [rows, safePage, pageSize],
  );

  return { pageRows, page: safePage, setPage, pageSize, setPageSize, total, totalPages };
}
