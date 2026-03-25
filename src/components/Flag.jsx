// src/components/Flag.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Flag component — renders a flagcdn.com image with an emoji fallback.
// Handles singles (one flag) and doubles ("ESP/ARG" → two flags, or
// "ITA/ITA" → same flag twice, or "ITA" with a doubles name → duplicated).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { getFlagDisplay } from '../services/tennisApi';

function SingleFlag({ country, size, style }) {
  const [errored, setErrored] = useState(false);

  if (!country || !country.trim()) {
    return (
      <span style={{
        display: 'inline-block',
        width: size,
        height: Math.round(size * 0.75),
        borderRadius: '2px',
        background: 'var(--border-md)',
        flexShrink: 0,
        verticalAlign: 'middle',
        ...style,
      }} />
    );
  }

  const flag = getFlagDisplay(country);

  // If image errored out, fall back to emoji
  if (flag.type === 'img' && !errored) {
    return (
      <img
        src={flag.src}
        alt={flag.alt}
        width={size}
        height={Math.round(size * 0.75)}
        style={{
          display: 'inline-block',
          verticalAlign: 'middle',
          borderRadius: '2px',
          objectFit: 'cover',
          flexShrink: 0,
          ...style,
        }}
        onError={() => setErrored(true)}
      />
    );
  }

  // Emoji fallback (either flag.type === 'emoji', or image errored)
  const emoji = flag.type === 'emoji' ? flag.char : (flag.fallbackEmoji ?? '🏳️');
  return (
    <span style={{
      fontSize: size * 0.9,
      lineHeight: 1,
      flexShrink: 0,
      verticalAlign: 'middle',
      display: 'inline-block',
      ...style,
    }}>
      {emoji}
    </span>
  );
}

export default function Flag({ country, name, size = 24, style = {} }) {
  const countrySrc = country ?? '';
  const nameSrc    = name    ?? '';

  const isDoubles = countrySrc.includes('/') || nameSrc.includes('/');

  if (isDoubles) {
    let c1, c2;

    if (countrySrc.includes('/')) {
      const parts = countrySrc.split('/');
      c1 = parts[0]?.trim() ?? '';
      c2 = parts[1]?.trim() ?? '';
    } else if (countrySrc.trim()) {
      // Same-nation doubles pair — show the same flag twice
      c1 = countrySrc.trim();
      c2 = countrySrc.trim();
    } else {
      c1 = '';
      c2 = '';
    }

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        flexShrink: 0,
        verticalAlign: 'middle',
        ...style,
      }}>
        <SingleFlag country={c1} size={size} />
        <SingleFlag country={c2} size={size} />
      </span>
    );
  }

  return <SingleFlag country={countrySrc} size={size} style={style} />;
}