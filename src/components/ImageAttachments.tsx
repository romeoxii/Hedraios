import { useRef } from "react";

interface ImageAttachmentsProps {
    urls: string[];
    uploading: boolean;
    disabled?: boolean;
    onSelect: (files: FileList) => void;
    onRemove: (url: string) => void;
}

/** Thumbnail strip with add/remove. Shared by notes + readings forms. */
export function ImageAttachments({
    urls,
    uploading,
    disabled,
    onSelect,
    onRemove,
}: ImageAttachmentsProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="flex flex-col gap-2">
            {(urls.length > 0 || uploading) && (
                <div className="flex flex-wrap gap-2">
                    {urls.map((url) => (
                        <span key={url} className="relative inline-block">
                            <img
                                src={url}
                                alt="Attachment"
                                loading="lazy"
                                className="h-[72px] w-[72px] rounded-xl object-cover"
                                style={{ border: "1px solid var(--border)" }}
                            />
                            <button
                                type="button"
                                onClick={() => onRemove(url)}
                                aria-label="Remove image"
                                className="btn btn-sm absolute -top-2 -right-2 px-2"
                                style={{ borderRadius: "999px" }}
                            >
                                ×
                            </button>
                        </span>
                    ))}
                    {uploading && <span className="meta self-center">Uploading…</span>}
                </div>
            )}
            <div>
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    aria-label="Add images"
                    onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) onSelect(e.target.files);
                        e.target.value = "";
                    }}
                />
                <button
                    type="button"
                    disabled={disabled || uploading}
                    onClick={() => inputRef.current?.click()}
                    className="btn btn-sm"
                >
                    {urls.length === 0 ? "Add images" : "Add more"}
                </button>
            </div>
        </div>
    );
}
