import { linkify } from '../../data/linkify';

/** Message text with its links tappable. Opens in a new tab; the text is otherwise unchanged. */
export default function Linkified({ text }: { text: string }) {
  return (
    <>
      {linkify(text).map((p, i) => p.href
        ? <a key={i} href={p.href} target={p.href.startsWith('mailto:') ? undefined : '_blank'} rel="noopener noreferrer nofollow" style={{ color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: 2, overflowWrap: 'anywhere' }}>{p.text}</a>
        : <span key={i}>{p.text}</span>)}
    </>
  );
}
