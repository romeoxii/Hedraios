import { useEffect, useRef, useState } from "react";
import { subscribeToasts } from "../lib/toast";
import type { ToastKind } from "../lib/toast";

interface ToastItem {
    id: number;
    message: string;
    kind: ToastKind;
}

const LIFETIME_MS = 3200;

function ToastIcon({ kind }: { kind: ToastKind }) {
    if (kind === "error") {
        return (
            <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
        );
    }
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
    );
}

export function Toaster() {
    const [items, setItems] = useState<ToastItem[]>([]);
    const nextId = useRef(1);

    useEffect(
        () =>
            subscribeToasts(({ message, kind }) => {
                const id = nextId.current++;
                setItems((prev) => [...prev.slice(-2), { id, message, kind }]);
                window.setTimeout(() => {
                    setItems((prev) => prev.filter((t) => t.id !== id));
                }, LIFETIME_MS);
            }),
        [],
    );

    if (items.length === 0) return null;

    return (
        <div className="toaster" role="status" aria-live="polite">
            {items.map((t) => (
                <div key={t.id} className={`toast toast-${t.kind}`}>
                    <ToastIcon kind={t.kind} />
                    <span>{t.message}</span>
                </div>
            ))}
        </div>
    );
}
