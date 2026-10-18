import { describe, it, expect } from 'vitest';
import { parseCsv, parseJsonRows, guessMapping, mapRows, missingRequired, parseAny, columnsOf } from '../src/data/leadImport';

const csv = 'Name,place_id,Phone Number,Website,Reviews,Rating,State,Email\n"Joe\'s ""Best"" Pizza, LLC",ChIJ1,(303) 555-0100,joes.com,"1,204",4.6,co,JOE@X.COM\nNo Id Co,,555,,1,3,CO,\nDupe,ChIJ1,555,,1,3,CO,\n';
describe('lead importer', () => {
  it('reads CSV with quotes, commas and escaped quotes', () => {
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(3);
    expect(rows[0].Name).toBe('Joe\'s "Best" Pizza, LLC');
    expect(rows[0].Reviews).toBe('1,204');
  });
  it('reads JSON arrays, wrapped results and one-per-line', () => {
    expect(parseJsonRows('[{"a":1},{"a":2}]')).toHaveLength(2);
    expect(parseJsonRows('{"results":[{"a":1}]}')).toHaveLength(1);
    expect(parseJsonRows('{"a":1}\n{"a":2}\nnot json')).toHaveLength(2);
    expect(parseAny('x.csv', 'a,b\n1,2')).toEqual([{ a: '1', b: '2' }]);
  });
  it('guesses the mapping from column names', () => {
    const m = guessMapping(columnsOf(parseCsv(csv)));
    expect(m).toMatchObject({ place_id: 'place_id', business_name: 'Name', phone: 'Phone Number', website: 'Website', review_count: 'Reviews', rating: 'Rating', state: 'State', owner_email: 'Email' });
    expect(missingRequired({})).toEqual(['Google place ID', 'Business name']);
    expect(missingRequired(m)).toEqual([]);
  });
  it('cleans rows, skips ones without a place ID, and dedupes by place_id', () => {
    const { leads, skipped, duplicates } = mapRows(parseCsv(csv), guessMapping(columnsOf(parseCsv(csv))));
    expect(leads).toHaveLength(1); expect(skipped).toBe(1); expect(duplicates).toBe(1);
    expect(leads[0]).toMatchObject({ place_id: 'ChIJ1', review_count: 1204, rating: 4.6, state: 'CO', owner_email: 'joe@x.com' });
  });
  it('uses the mapping the user chose, not the guess', () => {
    const { leads } = mapRows([{ a: 'P1', b: 'Biz', c: 'x' }], { place_id: 'a', business_name: 'b' });
    expect(leads[0]).toMatchObject({ place_id: 'P1', business_name: 'Biz', phone: null });
  });
});
