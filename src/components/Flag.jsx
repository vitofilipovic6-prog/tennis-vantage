// src/components/Flag.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Flag component that handles both singles and doubles players.
//
// Singles: renders one flag image (flagcdn.com) with emoji fallback.
// Doubles: name/country come as "Player A/Player B" and "ESP/ARG".
//          We split on "/" and render two flags side by side.
//
// FIX: Doubles detection now triggers when EITHER country OR name has "/"
//      Previously it only triggered when country had "/" OR name had "/" AND
//      country was empty — this missed the common case of "ITA" country +
//      "Errani S / Paolini J" name.
// ─────────────────────────────────────────────────────────────────────────────
import { getFlagDisplay } from '../services/tennisApi';

function SingleFlag({ country, size, style }) {
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
          // On CDN failure, swap to the emoji span
          const span = document.createElement('span');
          span.style.fontSize = `${size * 0.85}px`;
          span.style.lineHeight = '1';
          span.style.flexShrink = '0';
          span.textContent = flag.fallbackEmoji ?? country ?? '🏳️';
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
  const nameSrc    = name ?? '';

  // FIX: Detect doubles if EITHER country OR name contains "/"
  // Previously: (nameSrc.includes('/') && !countrySrc) — missed "ITA" + "Errani S / Paolini J"
  const isDoubles = countrySrc.includes('/') || nameSrc.includes('/');

  if (isDoubles) {
    // Split country codes — e.g. "ESP/ARG" → ["ESP", "ARG"]
    // If country has slash, use both codes.
    // If country is a single code (e.g. "ITA"), use it for both players
    // (same-nationality pair) — better than showing two blank flags.
    let c1, c2;
    if (countrySrc.includes('/')) {
      const parts = countrySrc.split('/');
      c1 = parts[0]?.trim() ?? '';
      c2 = parts[1]?.trim() ?? '';
    } else {
      // Single country — both players from same nation, or one country unknown
      c1 = countrySrc.trim();
      c2 = ''; // second player country unknown — will show blank flag
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