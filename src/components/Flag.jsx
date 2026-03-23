// src/components/Flag.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Reliable flag component.
// Strategy:
//   1. Convert country code/name → 2-letter ISO
//   2. Render flagcdn.com image (crisp, universal)
//   3. If image fails to load → swap to emoji flag instantly
//   4. If country completely unknown → render 🏳️
//
// This replaces the broken onError approach that tried to insert text nodes
// next to a hidden image (which left an invisible broken element with no fallback).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { resolveFlag, TO_ISO2 } from '../services/tennisApi';

export default function Flag({ country, size = 24, style = {} }) {
  const [imgFailed, setImgFailed] = useState(false);

  if (!country) {
    return (
      <span style={{ fontSize: size * 0.85, lineHeight: 1, flexShrink: 0, ...style }}>
        🏳️
      </span>
    );
  }

  const trimmed = country.trim();

  // Resolve the 2-letter ISO code
  const iso2 =
    TO_ISO2[trimmed] ??
    TO_ISO2[trimmed.toUpperCase()] ??
    TO_ISO2[trimmed.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())] ??
    // Handle 2-letter codes passed directly
    (trimmed.length === 2 ? trimmed.toLowerCase() : null);

  const emojiFlag = resolveFlag(trimmed);
  const hasEmoji = emojiFlag && emojiFlag !== '🏳️';

  // If we have no ISO2 code or image already failed, render emoji
  if (!iso2 || imgFailed) {
    return (
      <span
        style={{
          fontSize: size * 0.85,
          lineHeight: 1,
          flexShrink: 0,
          display: 'inline-block',
          verticalAlign: 'middle',
          ...style,
        }}
        title={trimmed}
      >
        {hasEmoji ? emojiFlag : '🏳️'}
      </span>
    );
  }

  const imgSrc = `https://flagcdn.com/${Math.round(size)}x${Math.round(size * 0.75)}/${iso2.toLowerCase()}.png`;

  return (
    <img
      src={imgSrc}
      alt={trimmed}
      title={trimmed}
      width={size}
      height={Math.round(size * 0.75)}
      loading="lazy"
      onError={() => setImgFailed(true)}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        borderRadius: '2px',
        objectFit: 'cover',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
