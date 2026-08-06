import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useBrandLab } from '../../data/useBrandLab';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const inputStyle: CSSProperties = {
  background: '#1a1c21', border: '1px solid #2b2f36', borderRadius: 8, padding: '9px 12px',
  color: '#F5F6F7', fontSize: 13.5, outline: 'none',
};
const primaryBtn: CSSProperties = {
  alignSelf: 'flex-start', padding: '10px 18px', borderRadius: 999, background: '#F5F6F7',
  color: '#0A0B0D', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};

function MinimalPreview({ direction }: { direction: string }) {
  return (
    <div style={{ background: '#0A0B0D', border: '1px solid #22262B', borderRadius: 10, padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#565b64', textTransform: 'uppercase' }}>Direction 01 — Minimal</div>
      <div style={{ fontSize: 22, fontWeight: 400, color: '#F5F6F7', marginTop: 18, letterSpacing: '0.01em' }}>Your Brand</div>
      <div style={{ fontSize: 12, color: '#8A8F98', marginTop: 10, maxWidth: 260, marginInline: 'auto', lineHeight: 1.6 }}>{direction || 'A calm, restrained direction — whitespace does the work.'}</div>
      <div style={{ marginTop: 22, display: 'inline-block', padding: '8px 20px', border: '1px solid #565b64', borderRadius: 999, fontSize: 11, color: '#C7CAD1' }}>Get in touch</div>
    </div>
  );
}

function BoldPreview({ direction }: { direction: string }) {
  return (
    <div style={{ background: '#F5F6F7', border: '1px solid #22262B', borderRadius: 10, padding: '32px 24px' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#565b64', textTransform: 'uppercase', fontWeight: 700 }}>Direction 02 — Bold</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: '#0A0B0D', marginTop: 12, lineHeight: 1.05 }}>Your Brand,<br />louder.</div>
      <div style={{ fontSize: 12, color: '#3a3d43', marginTop: 10, maxWidth: 260, lineHeight: 1.6 }}>{direction || 'High-contrast, confident, impossible to scroll past.'}</div>
      <div style={{ marginTop: 18, display: 'inline-block', padding: '10px 22px', background: '#0A0B0D', color: '#F5F6F7', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>Start now</div>
    </div>
  );
}

function EditorialPreview({ direction }: { direction: string }) {
  return (
    <div style={{ background: '#101114', border: '1px solid #22262B', borderRadius: 10, padding: '32px 24px', display: 'flex', gap: 18 }}>
      <div style={{ width: 2, background: '#2b2f36', flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 10, letterSpacing: '0.12em', color: '#565b64', textTransform: 'uppercase' }}>Direction 03 — Editorial</div>
        <div style={{ fontSize: 24, fontStyle: 'italic', fontWeight: 500, color: '#F5F6F7', marginTop: 12, lineHeight: 1.3 }}>A story-led take on Your Brand.</div>
        <div style={{ fontSize: 12, color: '#8A8F98', marginTop: 10, maxWidth: 260, lineHeight: 1.6 }}>{direction || 'Text-forward, asymmetric, reads like a feature piece.'}</div>
        <div style={{ marginTop: 18, fontSize: 12, color: '#C7CAD1', textDecoration: 'underline', textUnderlineOffset: 3 }}>Read the full story →</div>
      </div>
    </div>
  );
}

export default function BrandLabScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { briefs, loading, addBrief, removeBrief } = useBrandLab();
  const [direction, setDirection] = useState('');
  const [url1, setUrl1] = useState('');
  const [url2, setUrl2] = useState('');
  const [url3, setUrl3] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [previewDirection, setPreviewDirection] = useState<string | null>(null);

  const submit = async () => {
    if (!direction.trim()) return;
    await addBrief({
      direction: direction.trim(),
      reference_url_1: url1.trim() || null,
      reference_url_2: url2.trim() || null,
      reference_url_3: url3.trim() || null,
    });
    setPreviewDirection(direction.trim());
    setDirection(''); setUrl1(''); setUrl2(''); setUrl3('');
    setShowForm(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={homeHeadStyle}>Brand Lab</div>
          <div style={homeSubStyle}>The visual/output half — pairs with Scaling Planner.</div>
        </div>
        <div style={primaryBtn} onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : '+ New brief'}</div>
      </div>

      <div style={{ fontSize: 12, color: '#565b64', marginTop: 14, maxWidth: 620, lineHeight: 1.5 }}>
        The 3 directions below are generic starter archetypes rendered live in the app (real markup, not images) —
        not yet generated from your 3 reference sites or a linked design template, since neither is wired up.
        Once you share the design template, these get replaced with directions actually informed by it.
      </div>

      {showForm && (
        <div style={{ background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: 20, marginTop: 20, maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input style={inputStyle} placeholder="Stated direction (e.g. 'premium, quiet confidence')" value={direction} onChange={(e) => setDirection(e.target.value)} />
          <input style={inputStyle} placeholder="Reference site 1" value={url1} onChange={(e) => setUrl1(e.target.value)} />
          <input style={inputStyle} placeholder="Reference site 2" value={url2} onChange={(e) => setUrl2(e.target.value)} />
          <input style={inputStyle} placeholder="Reference site 3" value={url3} onChange={(e) => setUrl3(e.target.value)} />
          <div style={primaryBtn} onClick={submit}>Generate directions</div>
        </div>
      )}

      {previewDirection !== null && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginTop: 24, maxWidth: 900 }}>
          <MinimalPreview direction={previewDirection} />
          <BoldPreview direction={previewDirection} />
          <EditorialPreview direction={previewDirection} />
        </div>
      )}

      <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', border: '1px solid #22262B', borderRadius: 14, overflow: 'hidden', maxWidth: 640 }}>
        {briefs.map((b) => (
          <div
            key={b.id}
            onClick={() => setPreviewDirection(b.direction)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderBottom: '1px solid #1c1e23', background: '#101114', cursor: 'pointer' }}
          >
            <span style={{ fontSize: 13.5, color: '#C7CAD1' }}>{b.direction}</span>
            <span style={{ fontSize: 12, color: '#565b64' }} onClick={(e) => { e.stopPropagation(); removeBrief(b.id); }}>Delete</span>
          </div>
        ))}
        {!loading && briefs.length === 0 && (
          <div style={{ padding: 18, fontSize: 13, color: '#565b64', background: '#101114' }}>No briefs yet.</div>
        )}
      </div>
    </div>
  );
}
