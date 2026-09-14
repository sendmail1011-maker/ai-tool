// Pure, env-var-free logic so this can be imported from client components
// (e.g. BottomNav) without pulling in server-only modules like @/lib/auth,
// which throws at import time in the browser if JWT_SECRET isn't set.
const FULL_ACCESS_ANONYMOUS_NAMES = new Set(["LEO", "LEO2"]);

export function isRestrictedAnonymous(session: { isAnonymous: boolean; name: string }) {
  return session.isAnonymous && !FULL_ACCESS_ANONYMOUS_NAMES.has(session.name.trim().toUpperCase());
}
