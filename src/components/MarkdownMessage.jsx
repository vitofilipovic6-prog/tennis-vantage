// ─────────────────────────────────────────────────────────────────────────────
// MarkdownMessage.jsx
// Lightweight markdown → JSX renderer for AI chat bubbles.
// No external library needed — handles exactly what Gemini outputs:
//   **bold**, bullet lists (- item), numbered lists, and paragraphs.
//
// Usage:
//   import MarkdownMessage from './MarkdownMessage';
//   <MarkdownMessage content={msg.content} />
//
// Place at: src/components/MarkdownMessage.jsx
// ─────────────────────────────────────────────────────────────────────────────

export default function MarkdownMessage({ content }) {
  if (!content) return null;

  const blocks = parseBlocks(content);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {blocks.map((block, i) => {
        if (block.type === 'bullet-list') {
          return (
            <ul key={i} style={{
              margin: 0, paddingLeft: 18,
              display: 'flex', flexDirection: 'column', gap: 5,
            }}>
              {block.items.map((item, j) => (
                <li key={j} style={{
                  fontSize: 14, lineHeight: 1.65,
                  color: 'var(--text-muted)',
                  listStyleType: 'none',
                  paddingLeft: 4,
                  display: 'flex', gap: 8,
                }}>
                  <span style={{ color: 'var(--lime)', flexShrink: 0, marginTop: 1 }}>▸</span>
                  <span>{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === 'numbered-list') {
          return (
            <ol key={i} style={{
              margin: 0, paddingLeft: 0,
              display: 'flex', flexDirection: 'column', gap: 5,
            }}>
              {block.items.map((item, j) => (
                <li key={j} style={{
                  fontSize: 14, lineHeight: 1.65,
                  color: 'var(--text-muted)',
                  listStyleType: 'none',
                  display: 'flex', gap: 8,
                }}>
                  <span style={{
                    color: 'var(--lime)', flexShrink: 0,
                    fontFamily: 'var(--font-mono)', fontSize: 12,
                    minWidth: 20, marginTop: 2,
                  }}>
                    {j + 1}.
                  </span>
                  <span>{renderInline(item)}</span>
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === 'heading') {
          return (
            <p key={i} style={{
              fontSize: 14, fontWeight: 700,
              color: 'var(--text)', lineHeight: 1.4,
              marginBottom: -4,
            }}>
              {renderInline(block.text)}
            </p>
          );
        }

        if (block.type === 'verdict') {
          return (
            <div key={i} style={{
              padding: '10px 14px',
              background: 'rgba(159,239,102,0.08)',
              border: '1px solid rgba(159,239,102,0.2)',
              borderRadius: 8,
            }}>
              <span style={{
                fontSize: 11, fontWeight: 700, color: 'var(--lime)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                Verdict
              </span>
              <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.65, marginTop: 4 }}>
                {renderInline(block.text)}
              </p>
            </div>
          );
        }

        if (block.type === 'divider') {
          return (
            <div key={i} style={{
              height: 1, background: 'var(--border)', margin: '2px 0',
            }} />
          );
        }

        // Default: paragraph
        if (!block.text?.trim()) return null;
        return (
          <p key={i} style={{
            fontSize: 14, lineHeight: 1.7,
            color: 'var(--text-muted)', margin: 0,
          }}>
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}

// ── Parse raw text into block-level elements ───────────────────────────────────
function parseBlocks(text) {
  const lines  = text.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines — they're just paragraph separators
    if (!line.trim()) { i++; continue; }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      blocks.push({ type: 'divider' });
      i++; continue;
    }

    // Heading: ## or ### prefix
    if (/^#{1,3}\s/.test(line)) {
      blocks.push({ type: 'heading', text: line.replace(/^#{1,3}\s+/, '') });
      i++; continue;
    }

    // Verdict block: "**Verdict:**" anywhere on its own line or followed by text
    if (/^\*\*verdict[:\s*]/i.test(line.trim())) {
      const verdictText = line.replace(/^\*\*verdict[:\s*]*/i, '').replace(/\*\*/g, '').trim();
      // Collect continuation lines until blank or new section
      let combined = verdictText;
      i++;
      while (i < lines.length && lines[i].trim() && !/^[-\d#*]/.test(lines[i])) {
        combined += ' ' + lines[i].trim();
        i++;
      }
      blocks.push({ type: 'verdict', text: combined });
      continue;
    }

    // Bullet list: lines starting with "- " or "* "
    if (/^[-*]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'bullet-list', items });
      continue;
    }

    // Numbered list: lines starting with "1. " etc
    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'numbered-list', items });
      continue;
    }

    // Paragraph: accumulate until blank line or list/heading
    let para = line;
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^[-*#\d]/.test(lines[i]) &&
      !/^---/.test(lines[i])
    ) {
      para += ' ' + lines[i].trim();
      i++;
    }
    blocks.push({ type: 'paragraph', text: para });
  }

  return blocks;
}

// ── Render inline markdown: **bold** and `code` ───────────────────────────────
function renderInline(text) {
  if (!text) return null;

  // Split on **bold** and `code` markers
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} style={{ color: 'var(--text)', fontWeight: 700 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} style={{
          fontFamily: 'var(--font-mono)', fontSize: 12,
          background: 'rgba(255,255,255,0.07)',
          padding: '1px 6px', borderRadius: 4,
          color: 'var(--lime)',
        }}>
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}