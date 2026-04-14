import themeConfig from '../theme.config';

/** Current theme key from localStorage or app default (`light` | `dark` | `system`). */
export function readPersistedTheme(): string {
    if (typeof localStorage === 'undefined') {
        return themeConfig.theme || 'light';
    }
    return localStorage.getItem('theme') || themeConfig.theme || 'light';
}

/** Whether the UI should use dark palette for this theme key. */
export function isEffectiveDarkMode(themeKey: string): boolean {
    if (themeKey === 'dark') return true;
    if (themeKey === 'light') return false;
    if (themeKey === 'system') {
        return Boolean(
            typeof window !== 'undefined' &&
                window.matchMedia &&
                window.matchMedia('(prefers-color-scheme: dark)').matches
        );
    }
    return false;
}

/**
 * Keep `dark` on `html` and `body` in sync with stored theme before React paints,
 * so Tailwind `dark:` utilities apply on first paint (avoids light flash / wrong surfaces).
 */
export function syncDocumentDarkClass(themeKey: string = readPersistedTheme()): boolean {
    const isDark = isEffectiveDarkMode(themeKey);
    if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', isDark);
        document.body.classList.toggle('dark', isDark);
    }
    return isDark;
}
