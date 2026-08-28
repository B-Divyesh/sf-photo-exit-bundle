export const PRODUCT_SLUG = 'photo-exit-bundle';
export const BILLING_BASE = 'https://api.sociobot.in/api/v1';
const TOKEN_KEY = `sb_license:${PRODUCT_SLUG}`;
const VERDICT_KEY = `sb_license_verdict:${PRODUCT_SLUG}`;
const DAY = 86_400_000;

interface Verdict {
  valid: boolean;
  checkedAt: number;
  reason?: string;
}

export function checkoutUrl(email = ''): string {
  const base = `${BILLING_BASE}/products/${PRODUCT_SLUG}/checkout`;
  return email ? `${base}?email=${encodeURIComponent(email)}` : base;
}

export function consumeReturnedLicense(): boolean {
  const url = new URL(window.location.href);
  const token = url.searchParams.get('license');
  if (!token) return false;
  localStorage.setItem(TOKEN_KEY, token.trim());
  localStorage.setItem(VERDICT_KEY, JSON.stringify({ valid: true, checkedAt: 0 } satisfies Verdict));
  url.searchParams.delete('license');
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  return true;
}

export function restoreLicense(token: string): void {
  localStorage.setItem(TOKEN_KEY, token.trim());
  localStorage.removeItem(VERDICT_KEY);
}

export function cachedUnlock(): boolean {
  if (!localStorage.getItem(TOKEN_KEY)) return false;
  try {
    return (JSON.parse(localStorage.getItem(VERDICT_KEY) ?? '') as Verdict).valid;
  } catch {
    return false;
  }
}

export async function verifyLicense(force = false): Promise<{ valid: boolean; reason?: string }> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return { valid: false, reason: 'missing' };
  try {
    const cached = JSON.parse(localStorage.getItem(VERDICT_KEY) ?? '') as Verdict;
    if (!force && Date.now() - cached.checkedAt < DAY) return cached;
  } catch { /* A malformed cache simply gets refreshed. */ }
  try {
    const response = await fetch(`${BILLING_BASE}/products/${PRODUCT_SLUG}/verify?license=${encodeURIComponent(token)}`);
    if (!response.ok) throw new Error('Verification service unavailable.');
    const data = await response.json() as { valid: boolean; reason?: string };
    const verdict: Verdict = { valid: data.valid, reason: data.reason, checkedAt: Date.now() };
    localStorage.setItem(VERDICT_KEY, JSON.stringify(verdict));
    return verdict;
  } catch {
    return { valid: cachedUnlock(), reason: 'offline' };
  }
}
