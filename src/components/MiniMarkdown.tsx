import type { CSSProperties, ReactNode } from 'react';

interface Props {
  text: string;
}

const h1: CSSProperties = { fontSize: 'var(--text-title)', fontWeight: 700, color: 'var(--text)', marginTop: 32, marginBottom: 10 };
const h2: CSSProperties = { fontSize: 'var(--text-head)', fontWeight: 700, color: 'var(--text)', marginTop: 28, marginBottom: 8 };
const h3: CSSProperties = { fontSize: 'var(--text-body-lg)', fontWeight: 600, color: 'var(--text)', marginTop: 18, marginBottom: 6 };
const p: CSSProperties = { fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 };
const li: CSSProperties = { fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 6 };
const hr: CSSProperties = { border: 'none', borderTop: '1px solid var(--border)', margin: '20px 0' };

// Inline **bold** / *italic* only — enough for how these docs are actually
// written, not a general markdown parser.
function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: 'var(--text)', fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 1) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <span key={i}>{part}</span>;
  });
}

/** A deliberately minimal renderer for Cristopher's own long-form
 *  marketing docs (headers, bullet/numbered lists, bold/italic, hr,
 *  paragraphs) — not a general-purpose markdown library, just enough to
 *  make his own prose readable in-app using the existing style tokens. */
export default function MiniMarkdown({ text }: Props) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '' ) { i += 1; continue; }
    if (line.trim() === '---') { blocks.push(<hr key={key++} style={hr} />); i += 1; continue; }
    if (line.startsWith('### ')) { blocks.push(<div key={key++} style={h3}>{inline(line.slice(4))}</div>); i += 1; continue; }
    if (line.startsWith('## ')) { blocks.push(<div key={key++} style={h2}>{inline(line.slice(3))}</div>); i += 1; continue; }
    if (line.startsWith('# ')) { blocks.push(<div key={key++} style={h1}>{inline(line.slice(2))}</div>); i += 1; continue; }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ul key={key++} style={{ margin: '0 0 12px', paddingLeft: 20 }}>
          {items.map((it, idx) => <li key={idx} style={li}>{inline(it)}</li>)}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={key++} style={{ margin: '0 0 12px', paddingLeft: 20 }}>
          {items.map((it, idx) => <li key={idx} style={li}>{inline(it)}</li>)}
        </ol>
      );
      continue;
    }

    // Plain paragraph — collect contiguous non-blank, non-block lines.
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,3}\s|---$|[-*]\s+|\d+\.\s+)/.test(lines[i])) {
      paraLines.push(lines[i]);
      i += 1;
    }
    blocks.push(<div key={key++} style={p}>{inline(paraLines.join(' '))}</div>);
  }

  return <div>{blocks}</div>;
}
