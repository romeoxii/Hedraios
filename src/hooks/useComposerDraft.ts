import { useCallback, useEffect, useRef, useState } from "react";

export interface ManualDraft<P> {
    id: string;
    savedAt: string;
    payload: P;
}

function autosaveKey(kind: string, userId: string): string {
    return `hedraios:autosave:${kind}:${userId}`;
}

function draftsKey(kind: string, userId: string): string {
    return `hedraios:drafts:${kind}:${userId}`;
}

function readSession<P>(key: string): P | null {
    try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw) as P;
    } catch {
        return null;
    }
}

function readDrafts<P>(key: string): ManualDraft<P>[] {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as ManualDraft<P>[];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

/**
 * Max 1 autosave per tab (sessionStorage, overwritten on every save).
 * Restores into the composer when it is empty — on mount and when the
 * tab/window regains focus. Never clobbers non-empty typing.
 */
export function useAutosave<P extends Record<string, string>>(
    kind: string,
    userId: string | undefined,
    payload: P,
    isEmpty: (p: P) => boolean,
    restore: (p: P) => void,
) {
    const payloadRef = useRef(payload);
    payloadRef.current = payload;
    const isEmptyRef = useRef(isEmpty);
    isEmptyRef.current = isEmpty;
    const restoreRef = useRef(restore);
    restoreRef.current = restore;

    const maybeRestore = useCallback(() => {
        if (!userId) return;
        const saved = readSession<P>(autosaveKey(kind, userId));
        if (!saved) return;
        // Only fill an empty composer — never overwrite what is typed.
        if (isEmptyRef.current(payloadRef.current)) {
            restoreRef.current(saved);
        }
    }, [kind, userId]);

    // Restore on mount / account switch.
    useEffect(() => {
        maybeRestore();
    }, [maybeRestore]);

    // Restore when focus comes back to an empty composer.
    useEffect(() => {
        if (!userId) return;
        const onFocus = () => maybeRestore();
        const onVisible = () => {
            if (document.visibilityState === "visible") maybeRestore();
        };
        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [userId, maybeRestore]);

    // Persist on focus loss / tab hide / refresh / route switch (unmount).
    useEffect(() => {
        if (!userId) return;
        const key = autosaveKey(kind, userId);
        const save = () => {
            try {
                const p = payloadRef.current;
                if (isEmptyRef.current(p)) {
                    sessionStorage.removeItem(key);
                } else {
                    sessionStorage.setItem(key, JSON.stringify(p));
                }
            } catch {
                // Quota or private mode — autosave is best-effort.
            }
        };
        const onBlur = () => save();
        const onHidden = () => {
            if (document.visibilityState === "hidden") save();
        };
        const onUnload = () => save();
        window.addEventListener("blur", onBlur);
        document.addEventListener("visibilitychange", onHidden);
        window.addEventListener("beforeunload", onUnload);
        // Debounced typing safety net for crashes.
        const t = window.setInterval(save, 2000);
        return () => {
            save();
            window.clearInterval(t);
            window.removeEventListener("blur", onBlur);
            document.removeEventListener("visibilitychange", onHidden);
            window.removeEventListener("beforeunload", onUnload);
        };
    }, [kind, userId]);

    const clearAutosave = useCallback(() => {
        if (!userId) return;
        try {
            sessionStorage.removeItem(autosaveKey(kind, userId));
        } catch {
            // ignore
        }
    }, [kind, userId]);

    return { clearAutosave };
}

/** Unlimited manual drafts (localStorage, shared across tabs). */
export function useManualDrafts<P>(kind: string, userId: string | undefined) {
    const [drafts, setDrafts] = useState<ManualDraft<P>[]>([]);
    const key = userId ? draftsKey(kind, userId) : null;

    useEffect(() => {
        if (!key) {
            setDrafts([]);
            return;
        }
        setDrafts(readDrafts<P>(key));
    }, [key]);

    const saveDraft = useCallback(
        (payload: P): boolean => {
            if (!key) return false;
            const record: ManualDraft<P> = {
                id:
                    typeof crypto !== "undefined" && "randomUUID" in crypto
                        ? crypto.randomUUID()
                        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                savedAt: new Date().toISOString(),
                payload,
            };
            setDrafts((prev) => {
                const next = [record, ...prev];
                try {
                    localStorage.setItem(key, JSON.stringify(next));
                } catch {
                    // ignore
                }
                return next;
            });
            return true;
        },
        [key],
    );

    const deleteDraft = useCallback(
        (id: string) => {
            if (!key) return;
            setDrafts((prev) => {
                const next = prev.filter((d) => d.id !== id);
                try {
                    localStorage.setItem(key, JSON.stringify(next));
                } catch {
                    // ignore
                }
                return next;
            });
        },
        [key],
    );

    return { drafts, saveDraft, deleteDraft };
}
