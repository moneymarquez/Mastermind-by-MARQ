// Twilio only accepts E.164 (+17372583742). People save numbers every
// other way — "17372583742", "(737) 258-3742", "737-258-3742" — so every
// number is normalised right before it goes to Twilio. US/Canada is the
// default for bare 10-digit numbers.
export function toE164(raw: string | null | undefined): string {
  const s = (raw ?? '').trim();
  if (!s) return '';
  const digits = s.replace(/\D/g, '');
  if (s.startsWith('+')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}
