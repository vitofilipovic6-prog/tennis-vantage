// src/components/Flag.jsx
import { getFlagDisplay } from '../services/tennisApi';

export default function Flag({ country, size = 24, style = {} }) {
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
          e.currentTarget.style.display = 'none';
          e.currentTarget.insertAdjacentText('afterend', country ?? '');
        }}
      />
    );
  }

  // Emoji fallback (Mac/iOS/Android)
  return (
    <span style={{ fontSize: size * 0.85, lineHeight: 1, flexShrink: 0, ...style }}>
      {flag.char}
    </span>
  );
}
