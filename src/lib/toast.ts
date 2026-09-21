export type ToastKind = "success" | "error";

interface ToastInput {
    message: string;
    kind: ToastKind;
}

type Pusher = (toast: ToastInput) => void;

let pusher: Pusher | null = null;

/** Pop-up message. Safe to call before the toaster shows up (does nothing). */
export function toast(message: string, kind: ToastKind = "success") {
    pusher?.({ message, kind });
}

export function subscribeToasts(push: Pusher): () => void {
    pusher = push;
    return () => {
        if (pusher === push) pusher = null;
    };
}
