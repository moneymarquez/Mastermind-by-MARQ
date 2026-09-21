/** What the paper-trading bot can actually trade.
 *
 *  The bot runs on an Alpaca paper STOCK account and pulls bars from the
 *  stocks endpoint, so a watchlist entry has to be a US equity/ETF symbol:
 *  letters, optionally a dot for share classes (BRK.B). Gold ("XAU/USD")
 *  and crypto ("BTC-USD") live on different Alpaca APIs with different
 *  order types, and putting one in the list broke the ONE bars request the
 *  bot makes for the whole list — so SPY and QQQ never got evaluated
 *  either. The watchlist editor and the bot both check with this.
 *
 *  No React, no Supabase: the Worker imports it too. */
export function isTradableSymbol(sym: string): boolean {
  return /^[A-Z]{1,5}(\.[A-Z]{1,2})?$/.test(sym);
}

export function splitWatchlist(list: string[]): { valid: string[]; rejected: string[] } {
  const valid: string[] = [];
  const rejected: string[] = [];
  for (const raw of list) {
    const s = raw.trim().toUpperCase();
    if (!s) continue;
    if (isTradableSymbol(s)) { if (!valid.includes(s)) valid.push(s); }
    else rejected.push(s);
  }
  return { valid, rejected };
}
