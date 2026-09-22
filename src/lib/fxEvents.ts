/** Tiny pub/sub for the two fx moments triggered from business code:
 *  celebrate() (a closed client) and previewIntro() (settings replay).
 *  Lives outside the component files so fast refresh keeps working. */
import { blip, haptic } from './motion';

const celebrateListeners = new Set<() => void>();
export function onCelebrate(l: () => void): () => void {
  celebrateListeners.add(l);
  return () => { celebrateListeners.delete(l); };
}
export function celebrate(): void {
  blip('close');
  haptic('complete');
  for (const l of celebrateListeners) l();
}

const previewListeners = new Set<() => void>();
export function onPreviewIntro(l: () => void): () => void {
  previewListeners.add(l);
  return () => { previewListeners.delete(l); };
}
export function previewIntro(): void { for (const l of previewListeners) l(); }
