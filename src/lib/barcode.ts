// Open Food Facts: free, keyless, CORS-open product database — chosen over
// USDA FoodData Central (which needs an API key/signup) so barcode scanning
// works with zero setup. Coverage skews toward packaged/branded foods, which
// is exactly the barcode use case (USDA's strength — raw/generic foods — is
// better served by the photo/manual logging paths already in place).
const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product';

export interface BarcodeProduct {
  barcode: string;
  name: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  servingSize: string | null;
}

export class BarcodeLookupError extends Error {}

// OFF nutriments are reported per-100g by default; per-serving values (what
// we actually want to log) are only present when the product's packaging
// specifies a serving size, under the `_serving` suffixed keys.
export async function lookupBarcode(barcode: string): Promise<BarcodeProduct> {
  let res: Response;
  try {
    res = await fetch(`${OFF_BASE}/${encodeURIComponent(barcode)}.json`);
  } catch {
    throw new BarcodeLookupError('Could not reach the food database — check your connection.');
  }
  if (!res.ok) throw new BarcodeLookupError(`Lookup failed (${res.status}).`);

  const body = await res.json();
  if (body.status !== 1 || !body.product) {
    throw new BarcodeLookupError('No product found for that barcode.');
  }

  const p = body.product;
  const n = p.nutriments ?? {};
  const perServing = n['energy-kcal_serving'] != null;
  const round = (v: unknown) => (typeof v === 'number' ? Math.round(v) : null);

  return {
    barcode,
    name: p.product_name || p.generic_name || 'Unknown product',
    calories: perServing ? round(n['energy-kcal_serving']) : round(n['energy-kcal_100g']),
    protein_g: perServing ? round(n['proteins_serving']) : round(n['proteins_100g']),
    carbs_g: perServing ? round(n['carbohydrates_serving']) : round(n['carbohydrates_100g']),
    fat_g: perServing ? round(n['fat_serving']) : round(n['fat_100g']),
    servingSize: p.serving_size || (perServing ? null : 'per 100g (no serving size on packaging)'),
  };
}

// The native BarcodeDetector API (Chrome/Android, and Safari 17+) avoids
// pulling in a JS barcode-scanning library entirely. Feature-detected so the
// UI can fall back to manual UPC entry where it's unavailable (desktop
// Firefox, older Safari).
export function supportsBarcodeDetector(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}
