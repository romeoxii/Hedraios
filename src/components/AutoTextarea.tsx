import { useEffect, useRef } from "react";
import type { TextareaHTMLAttributes } from "react";

interface AutoTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    /** Cap growth; beyond this the field scrolls. Defaults to 50vh. */
    maxHeight?: number;
}

/** Grows as you type. No resize handle — height follows content. */
export function AutoTextarea({ maxHeight = 400, value, ...rest }: AutoTextareaProps) {
    const ref = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.style.height = "auto";
        const next = Math.min(el.scrollHeight, maxHeight);
        el.style.height = `${next}px`;
        el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
    }, [value, maxHeight]);

    return <textarea ref={ref} value={value} {...rest} />;
}
