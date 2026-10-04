/** Two skins for one lead.
 *
 *  The same lead renders inside LeadFlow (its own design system: Geist,
 *  green on paper / lime on teal) and inside Dialing, which is core
 *  Masterminds. Rather than fork the markup, every color the lead card uses
 *  is an --lf-* token, and the skin only decides which token set applies:
 *
 *  'leadflow'   — the LeadFlow tokens (leadflow.css, .leadflow)
 *  'mastermind' — the same tokens mapped onto Masterminds V2 variables
 *                 (.leadflow.lf-mm): Inter, gray-black, 16px cards.
 *
 *  Signal hues (go / wait / stop / info / neutral) are deliberately the same
 *  in both: they are meaning, not decoration.
 */
export type LeadSkin = 'leadflow' | 'mastermind';

export function skinClass(skin: LeadSkin): string {
  return skin === 'mastermind' ? 'leadflow lf-mm' : 'leadflow';
}
