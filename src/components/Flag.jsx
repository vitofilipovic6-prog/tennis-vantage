// src/components/Flag.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Flag component that handles both singles and doubles players.
//
// Singles: renders one flag image (flagcdn.com) with emoji fallback.
// Doubles: name/country come as "Player A/Player B" and "ESP/ARG".
//          We split on "/" and render two flags side by side.
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
  // Detect doubles pair — country like "ESP/ARG" or name like "Granollers/Zeballos"
  const countrySrc = country ?? '';
  const nameSrc    = name ?? '';

  const isDoubles =
    countrySrc.includes('/') ||
    (nameSrc.includes('/') && !countrySrc); // name-only fallback

  if (isDoubles) {
    // Split country codes — e.g. "ESP/ARG" → ["ESP", "ARG"]
    const countries = countrySrc.includes('/')
      ? countrySrc.split('/')
      : ['', '']; // no country data, show two blank flags

    const [c1, c2] = countries;

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
        <SingleFlag country={c1.trim()} size={size} />
        <SingleFlag country={c2.trim()} size={size} />
      </span>
    );
  }

  // Singles — original behaviour
  return <SingleFlag country={countrySrc} size={size} style={style} />;
}
