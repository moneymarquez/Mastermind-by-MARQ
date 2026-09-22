import { useSkin } from '../../data/useTheme';

/** Loading placeholder. Cyberpunk shimmers a neon bar; Simple keeps the
 *  em-dash the app has always shown, so nothing about it changes there. */
export default function Skeleton({ width = 64, height = 22, fallback = '—' }: { width?: number; height?: number; fallback?: string }) {
  const skin = useSkin();
  if (skin !== 'cyberpunk') return <>{fallback}</>;
  return <span className="fx-skeleton" style={{ width, height, verticalAlign: 'middle' }} aria-label="Loading">{fallback}</span>;
}
