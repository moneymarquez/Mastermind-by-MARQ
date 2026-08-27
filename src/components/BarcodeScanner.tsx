import { useEffect, useRef, useState } from 'react';
import { supportsBarcodeDetector } from '../lib/barcode';
import Icon from '../Icon';

interface Props {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

// Live camera scan via the native BarcodeDetector API where supported;
// falls back to manual UPC entry everywhere else (desktop Firefox, older
// Safari) rather than pulling in a JS decoding library for it.
export default function BarcodeScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [error, setError] = useState('');
  const detectorSupported = supportsBarcodeDetector();

  useEffect(() => {
    if (!detectorSupported) return;
    let cancelled = false;
    let rafId: number;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Detector = (window as any).BarcodeDetector;
        const detector = new Detector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });

        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              onScan(codes[0].rawValue);
              return;
            }
          } catch {
            // transient decode failures are normal mid-scan — keep looping
          }
          rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) setError('Could not access the camera — enter the barcode manually below.');
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [detectorSupported, onScan]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(6,7,9,0.9)', zIndex: 200,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)', fontSize: 'var(--text-label)', fontWeight: 600 }}>
        <Icon name="barcode" color="var(--text)" /> Scan a barcode
        <span style={{ marginLeft: 12, cursor: 'pointer', padding: 4 }} onClick={onClose}>
          <Icon name="x" color="var(--text-secondary)" />
        </span>
      </div>

      {detectorSupported && !error && (
        <video ref={videoRef} muted playsInline style={{ width: '100%', maxWidth: 360, borderRadius: 'var(--radius-lg)', background: '#000' }} />
      )}
      {error && <div style={{ fontSize: 'var(--text-body-sm)', color: '#c47a7a', maxWidth: 320, textAlign: 'center' }}>{error}</div>}
      {!detectorSupported && (
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', maxWidth: 320, textAlign: 'center' }}>
          Live scanning isn't supported in this browser — enter the barcode number instead.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          autoFocus={!detectorSupported}
          inputMode="numeric"
          placeholder="Barcode number"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && manualCode.trim() && onScan(manualCode.trim())}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: 'var(--text)', fontSize: 'var(--text-label)', width: 220, outline: 'none' }}
        />
        <div
          style={{ display: 'flex', alignItems: 'center', padding: '10px 18px', borderRadius: 'var(--radius-sm)', background: manualCode.trim() ? 'var(--text)' : 'var(--border)', color: manualCode.trim() ? 'var(--bg)' : 'var(--text-tertiary)', fontSize: 'var(--text-body)', fontWeight: 600, cursor: manualCode.trim() ? 'pointer' : 'default' }}
          onClick={() => manualCode.trim() && onScan(manualCode.trim())}
        >
          Look up
        </div>
      </div>
    </div>
  );
}
