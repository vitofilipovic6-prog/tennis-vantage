// src/components/Flag.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Flag component — renders a flagcdn.com image with an emoji fallback.
// Handles singles AND doubles (name like "A. Smith / B. Jones").
//
// FIX: Previously blank flags appeared for doubles because:
//  1. country arrived as "" when name contained "/" (API sends one code for pair)
//  2. getFlagDisplay("") returned a blank placeholder, not a flag
//
// Now: if country is empty but name is a doubles pair, we attempt to infer
// country from nothing (shows neutral flag). If country is "ITA/ITA" or
// "ESP/ARG" format, both flags render correctly.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { getFlagDisplay } from '../services/tennisApi';

function SingleFlag({ country, size, style }) {
  const [errored, setErrored] = useState(false);

  // Empty country — show a neutral grey placeholder (not broken img)
  if (!country || !country.trim()) {
    return (
      <span style={{
        display: 'inline-block',
        width: size,
        height: Math.round(size * 0.75),
        borderRadius: '2px',
        background: 'rgba(255,255,255,0.12)',
        flexShrink: 0,
        verticalAlign: 'middle',
        ...style,
      }} />
    );
  }

  const flag = getFlagDisplay(country.trim());

  if (flag.type === 'img' && !errored) {
    return (
      <img
        src={flag.src}
        alt={flag.alt ?? country}
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

  // Emoji fallback
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
  const countrySrc = (country ?? '').trim();
  const nameSrc    = (name    ?? '').trim();

  const isDoublesName    = nameSrc.includes('/');
  const isDoublesCountry = countrySrc.includes('/');
  const isDoubles        = isDoublesName || isDoublesCountry;

  if (isDoubles) {
    let c1 = '', c2 = '';

    if (isDoublesCountry) {
      // "ESP/ARG" or "ITA/ITA"
      const parts = countrySrc.split('/');
      c1 = parts[0]?.trim() ?? '';
      c2 = parts[1]?.trim() ?? '';
    } else if (countrySrc) {
      // Same-nation pair — API sent one code, duplicate it
      c1 = countrySrc;
      c2 = countrySrc;
    }
    // If country is empty for doubles, c1/c2 remain '' → grey placeholder shown

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

  // Singles
  return <SingleFlag country={countrySrc} size={size} style={style} />;
}