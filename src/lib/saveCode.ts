// A ?code=MARQ20 link remembers its code, so it's still there when the person
// reaches checkout later (the waitlist form, then the app after launch).
try {
  const c = new URLSearchParams(window.location.search).get('code')?.trim().toUpperCase().slice(0, 32);
  if (c && /^[A-Z0-9-]{2,32}$/.test(c)) localStorage.setItem('mm_code', c);
} catch { /* private mode or blocked storage: the code in the URL still works for this visit */ }
export {};
