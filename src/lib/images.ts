import { supabase } from "./supabaseClient";

export const MAX_IMAGES_PER_ENTRY = 6;
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const ENTRY_IMAGES_BUCKET = "entry-images";
export type EntryImageKind = "entry" | "reading";

function extFor(file: File, blob: Blob): string {
    if (blob.type.includes("png")) return "png";
    if (blob.type.includes("webp")) return "webp";
    const fromName = file.name.split(".").pop()?.toLowerCase();
    if (fromName === "png" || fromName === "webp" || fromName === "jpg" || fromName === "jpeg") {
        return fromName === "jpeg" ? "jpg" : fromName;
    }
    return "jpg";
}

/** Downscales huge photos so uploads stay small. Keeps PNG/WebP when transparent. */
export async function compressImage(file: File): Promise<Blob> {
    if (!file.type.startsWith("image/")) {
        throw new Error("Only image files are allowed.");
    }
    if (file.size > MAX_FILE_BYTES) {
        throw new Error("Image is too large (max 10MB).");
    }
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) {
        bitmap.close();
        return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        bitmap.close();
        return file;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const type = file.type.includes("png") || file.type.includes("webp") ? file.type : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, type, JPEG_QUALITY),
    );
    return blob ?? file;
}

function pathFor(userId: string, kind: EntryImageKind, ownerId: string, file: File, blob: Blob) {
    const rand =
        typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
    return `${userId}/${kind}/${ownerId}/${rand}.${extFor(file, blob)}`;
}

function pathFromUrl(url: string): string | null {
    const marker = `${ENTRY_IMAGES_BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(url.slice(idx + marker.length).split("?")[0]);
}

/** Uploads one image. Owner id is the remote uuid when synced, else `local-<id>`. */
export async function uploadEntryImage(
    userId: string,
    kind: EntryImageKind,
    ownerId: string,
    file: File,
): Promise<string> {
    const blob = await compressImage(file);
    const path = pathFor(userId, kind, ownerId, file, blob);
    const { error } = await supabase.storage
        .from(ENTRY_IMAGES_BUCKET)
        .upload(path, blob, { contentType: blob.type || file.type, upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from(ENTRY_IMAGES_BUCKET).getPublicUrl(path);
    // Private bucket: public URL works once a permissive SELECT policy exists;
    // otherwise callers can swap this for createSignedUrl.
    return data.publicUrl;
}

/** Best-effort removal from storage. Never throws. */
export async function deleteEntryImage(url: string): Promise<void> {
    const path = pathFromUrl(url);
    if (!path) return;
    const { error } = await supabase.storage.from(ENTRY_IMAGES_BUCKET).remove([path]);
    if (error) console.warn("[hedraios] image delete failed:", error.message);
}
