const SIZES = [10, 25, 50];

export default function Pagination({
  page,
  setPage,
  pageSize,
  setPageSize,
  total,
  totalPages,
  from,
  to,
}) {
  if (total === 0) return null;

  const canPrev = page > 1;
  const canNext = page < totalPages;

  const pages = [];
  const window = 2;
  let start = Math.max(1, page - window);
  let end = Math.min(totalPages, page + window);
  if (end - start < window * 2) {
    start = Math.max(1, end - window * 2);
    end = Math.min(totalPages, start + window * 2);
  }
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="pagination">
      <p className="pagination-info">
        {from}–{to} de {total}
      </p>

      <div className="pagination-controls">
        <label className="pagination-size">
          <span className="hidden sm:inline">Por página</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            aria-label="Filas por página"
          >
            {SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="btn-secondary pagination-btn"
          disabled={!canPrev}
          onClick={() => setPage(page - 1)}
          aria-label="Anterior"
        >
          ‹
        </button>

        <div className="pagination-pages">
          {start > 1 && (
            <>
              <button type="button" className="pagination-page" onClick={() => setPage(1)}>1</button>
              {start > 2 && <span className="pagination-ellipsis">…</span>}
            </>
          )}
          {pages.map((p) => (
            <button
              key={p}
              type="button"
              className={`pagination-page ${p === page ? 'active' : ''}`}
              onClick={() => setPage(p)}
            >
              {p}
            </button>
          ))}
          {end < totalPages && (
            <>
              {end < totalPages - 1 && <span className="pagination-ellipsis">…</span>}
              <button type="button" className="pagination-page" onClick={() => setPage(totalPages)}>{totalPages}</button>
            </>
          )}
        </div>

        <button
          type="button"
          className="btn-secondary pagination-btn"
          disabled={!canNext}
          onClick={() => setPage(page + 1)}
          aria-label="Siguiente"
        >
          ›
        </button>
      </div>
    </div>
  );
}
