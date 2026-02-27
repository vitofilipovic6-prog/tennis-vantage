// ToastContainer.jsx
export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', gap: '10px',
      zIndex: 9999, alignItems: 'center', pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function Toast({ toast, onDismiss }) {
  const palettes = {
    success: { bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.35)',  text: '#4ade80' },
    error:   { bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.35)', text: '#f87171' },
    info:    { bg: 'rgba(159,239,102,0.10)', border: 'rgba(159,239,102,0.3)',  text: '#9fef66' },
    warning: { bg: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.35)', text: '#fbbf24' },
  };
  const p = palettes[toast.type] ?? palettes.info;
  const icon = { success: '✓', error: '✕', info: '◆', warning: '⚠' }[toast.type] ?? '◆';

  return (
    <div
      className="tv-pop"
      onClick={() => onDismiss(toast.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '13px 22px',
        background: p.bg, border: `1px solid ${p.border}`,
        backdropFilter: 'blur(20px)',
        borderRadius: '12px',
        color: p.text, fontFamily: 'var(--font-body)',
        fontWeight: 600, fontSize: '14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        pointerEvents: 'all', cursor: 'pointer',
        maxWidth: '88vw', minWidth: '260px',
        userSelect: 'none',
      }}
    >
      <span style={{ fontSize: '16px' }}>{icon}</span>
      {toast.message}
    </div>
  );
}
