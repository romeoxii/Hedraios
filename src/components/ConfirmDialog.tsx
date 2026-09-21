import { useEffect } from "react";

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = "Delete",
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onCancel]);

    if (!open) return null;

    return (
        <div
            className="overlay"
            role="presentation"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onCancel();
            }}
        >
            <div role="alertdialog" aria-modal="true" aria-label={title} className="dialog">
                <p className="dialog-title">{title}</p>
                <p className="dialog-body">{message}</p>
                <div className="dialog-actions">
                    <button type="button" onClick={onCancel} autoFocus className="btn">
                        Cancel
                    </button>
                    <button type="button" onClick={onConfirm} className="btn btn-danger">
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
