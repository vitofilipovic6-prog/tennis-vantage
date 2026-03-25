// src/components/Flag.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Flag component handling singles and doubles players.
//
// Singles: renders one flag image (flagcdn.com) with emoji fallback.
//
// Doubles: name/country arrive as "Player A / Player B" and either:
//   a) "ESP/ARG" — two country codes, one per player  ← show two different flags
//   b) "ITA"    — one code for same-nationality pair  ← show that flag twice
//   c) ""       — no country info at all              ← show two blank flags
//
// The previous version showed a blank flag for the second player in case (b)
// because it passed an empty string to SingleFlag. This version fills in the
// single country for both players when there is no slash in the country string.
// ─────────────────────────────────────────────────────────────────────────────
import { getFlagDisplay } from '../services/tennisApi';

function SingleFlag({ country, size, style }) {
  if (!country || !country.trim()) {
    // Graceful blank — small neutral circle instead of broken image
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

  if (flag.type === 'img') {
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
        onError={e => {
          const span = document.createElement('span');
          span.style.fontSize = `${size * 0.85}px`;
          span.style.lineHeight = '1';
          span.style.flexShrink = '0';
          span.textContent = flag.fallbackEmoji ?? '🏳️';
          e.currentTarget.replaceWith(span);
        }}
      />
    );
  }

  return (
    <span style={{ fontSize: size * 0.85, lineHeight: 1, flexShrink: 0, ...style }}>
      {flag.char}
    </span>
  );
}

export default function Flag({ country, name, size = 24, style = {} }) {
  const countrySrc = country ?? '';
  const nameSrc    = name    ?? '';

  // Detect doubles: either country OR name contains "/"
  const isDoubles = countrySrc.includes('/') || nameSrc.includes('/');

  if (isDoubles) {
    let c1, c2;

    if (countrySrc.includes('/')) {
      // Case (a): "ESP/ARG" — two distinct country codes
      const parts = countrySrc.split('/');
      c1 = parts[0]?.trim() ?? '';
      c2 = parts[1]?.trim() ?? '';
    } else if (countrySrc.trim()) {
      // Case (b): single country code — same-nationality pair
      // Show the same flag for both players (correct: e.g. ITA/ITA)
      c1 = countrySrc.trim();
      c2 = countrySrc.trim();
    } else {
      // Case (c): no country info at all
      c1 = '';
      c2 = '';
    }

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '2px',
          flexShrink: 0,
          verticalAlign: 'middle',
          ...style,
        }}
      >
        <SingleFlag country={c1} size={size} />
        <SingleFlag country={c2} size={size} />
      </span>
    );
  }

  // Singles — original behaviour
  return <SingleFlag country={countrySrc} size={size} style={style} />;
}