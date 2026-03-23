// src/components/Flag.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Simple, reliable flag component using emoji only.
// Emoji flags work natively on every modern browser, OS, and mobile device.
// No CDN dependency, no broken onError handlers, no missing images.
// ─────────────────────────────────────────────────────────────────────────────
import { resolveFlag } from '../services/tennisApi';

export default function Flag({ country, size = 24, style = {} }) {
  const emoji = resolveFlag(country ?? '');

  return (
    <span
      title={country ?? ''}
      style={{
        fontSize: size * 0.85,
        lineHeight: 1,
        flexShrink: 0,
        display: 'inline-block',
        verticalAlign: 'middle',
        ...style,
      }}
    >
      {emoji}
    </span>
  );
}
