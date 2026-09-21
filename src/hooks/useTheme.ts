import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const KEY = "hedraios-theme";
const META_SELECTOR = 'meta[name="theme-color"]';
const META_COLORS: Record<Theme, string> = {
    light: "#fafafa",
    dark: "#0a0a0b",
};

function readStored(): Theme | null {
    try {
        const stored = window.localStorage.getItem(KEY);
        return stored === "light" || stored === "dark" ? stored : null;
    } catch {
        return null;
    }
}

function systemTheme(): Theme {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
    document.documentElement.dataset.theme = theme;
    document.querySelector(META_SELECTOR)?.setAttribute("content", META_COLORS[theme]);
}

export function useTheme() {
    const [theme, setTheme] = useState<Theme>(() => readStored() ?? systemTheme());
    const [explicit, setExplicit] = useState<boolean>(() => readStored() != null);

    useEffect(() => {
        applyTheme(theme);
        if (explicit) {
            try {
                window.localStorage.setItem(KEY, theme);
            } catch {
                // Private browsing: the choice just will not stick.
            }
        }
    }, [theme, explicit]);

    // Follows the phone setting until a choice gets tapped.
    useEffect(() => {
        if (explicit) return;
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        const onChange = (e: MediaQueryListEvent) => setTheme(e.matches ? "dark" : "light");
        mq.addEventListener("change", onChange);
        return () => mq.removeEventListener("change", onChange);
    }, [explicit]);

    const toggle = useCallback(() => {
        setExplicit(true);
        setTheme((t) => (t === "light" ? "dark" : "light"));
    }, []);

    return { theme, toggle };
}
