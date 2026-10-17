/** Breaks circular imports between axios interceptors and Redux; wired from `main.tsx`. */

type TokenSyncFn = (token: string) => void;
type AuthClearFn = () => void;

let onAccessTokenRefreshed: TokenSyncFn | null = null;
let onAuthClear: AuthClearFn | null = null;

export function registerAccessTokenSync(fn: TokenSyncFn): void {
  onAccessTokenRefreshed = fn;
}

export function registerAuthClear(fn: AuthClearFn): void {
  onAuthClear = fn;
}

export function notifyAccessTokenRefreshed(token: string): void {
  onAccessTokenRefreshed?.(token);
}

export function triggerAuthClear(): void {
  onAuthClear?.();
}
