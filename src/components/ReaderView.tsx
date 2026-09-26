interface ReaderViewProps {
    backLabel: string;
    onBack: () => void;
    eyebrow?: string;
    title: string;
    dateLabel: string;
    body: string;
    tags: string[];
    images?: string[];
}

/** Full reading page: back link, big title, date, the whole text, tags. */
export function ReaderView({
    backLabel,
    onBack,
    eyebrow,
    title,
    dateLabel,
    body,
    tags,
    images = [],
}: ReaderViewProps) {
    return (
        <article className="flex flex-col py-6">
            <button
                type="button"
                onClick={onBack}
                className="link-btn self-start"
                style={{ fontSize: "0.875rem" }}
            >
                ‹ {backLabel}
            </button>
            {eyebrow && (
                <p
                    className="mt-6 font-medium uppercase"
                    style={{
                        fontSize: "0.75rem",
                        letterSpacing: "0.06em",
                        color: "var(--accent)",
                    }}
                >
                    {eyebrow}
                </p>
            )}
            <h1
                className="section-title mt-2 break-words"
                style={{
                    fontSize: "1.75rem",
                    lineHeight: 1.25,
                    letterSpacing: "-0.02em",
                }}
            >
                {title}
            </h1>
            <p className="meta mt-2" style={{ fontSize: "0.8125rem" }}>
                {dateLabel}
            </p>
            <div
                className="body-text mt-6 whitespace-pre-wrap"
                style={{ fontSize: "1rem", opacity: 1 }}
            >
                {body}
            </div>
            {images.length > 0 && (
                <div className="mt-6 flex flex-col gap-3">
                    {images.map((url) => (
                        <img
                            key={url}
                            src={url}
                            alt="Attachment"
                            loading="lazy"
                            className="w-full rounded-2xl object-cover"
                            style={{
                                border: "1px solid var(--border)",
                                maxHeight: "32rem",
                            }}
                        />
                    ))}
                </div>
            )}
            {tags.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                        <span key={tag} className="chip">
                            #{tag}
                        </span>
                    ))}
                </div>
            )}
        </article>
    );
}
