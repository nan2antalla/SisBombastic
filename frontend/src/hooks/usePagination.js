import { useEffect, useMemo, useState } from 'react';

/**
 * Paginación estable: no reinicia la página solo porque el array
 * cambió de referencia (p. ej. .filter() en cada render).
 */
export function usePagination(items, initialPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const list = items || [];
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

  const firstId = list[0]?.id ?? list[0]?.cliente_id ?? '';
  const lastId = list[total - 1]?.id ?? list[total - 1]?.cliente_id ?? '';
  const listSignature = `${total}:${firstId}:${lastId}`;

  useEffect(() => {
    setPage(1);
  }, [listSignature, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return list.slice(start, start + pageSize);
  }, [list, page, pageSize]);

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    total,
    totalPages,
    pageItems,
    from,
    to,
  };
}
