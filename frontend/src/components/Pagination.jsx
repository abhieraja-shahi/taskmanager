export default function Pagination({ page, totalPages, onPage, totalItems, pageSize }) {
  if (totalPages <= 1) return null

  const pages = []
  const delta = 2
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
      pages.push(i)
    }
  }

  // Insert ellipsis markers
  const withEllipsis = []
  let prev = null
  for (const p of pages) {
    if (prev !== null && p - prev > 1) withEllipsis.push('…')
    withEllipsis.push(p)
    prev = p
  }

  const from = (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, totalItems)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginTop: 16, gap: 12,
    }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        {from}–{to} of {totalItems}
      </span>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button
          className="btn btn-secondary btn-sm"
          disabled={page === 1}
          onClick={() => onPage(page - 1)}
          style={{ padding: '4px 10px' }}
        >
          ‹
        </button>
        {withEllipsis.map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} style={{ fontSize: 11, color: 'var(--text-muted)', padding: '0 4px' }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              style={{
                minWidth: 28, padding: '4px 6px', fontSize: 11,
                borderRadius: 'var(--radius-sm)', border: '1px solid',
                cursor: p === page ? 'default' : 'pointer',
                background: p === page ? 'var(--color-primary)' : 'transparent',
                color: p === page ? '#fff' : 'var(--text-secondary)',
                borderColor: p === page ? 'var(--color-primary)' : 'var(--border)',
                fontFamily: 'var(--font-body)',
              }}
              disabled={p === page}
            >
              {p}
            </button>
          )
        )}
        <button
          className="btn btn-secondary btn-sm"
          disabled={page === totalPages}
          onClick={() => onPage(page + 1)}
          style={{ padding: '4px 10px' }}
        >
          ›
        </button>
      </div>
    </div>
  )
}
