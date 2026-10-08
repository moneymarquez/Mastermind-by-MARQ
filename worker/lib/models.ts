// Worker-side entry to the role → model map (src/data/models.ts holds it so
// the app's Office screen and the roster config read the same table).
export { MODELS, ROLE_MODEL, SMS_PROVIDER, PRICE, ALLOWED_MODELS, costOf, BATCH_DISCOUNT } from '../../src/data/models';
export type { Role } from '../../src/data/models';
