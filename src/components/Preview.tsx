interface PreviewProps {
    text: string;
    lines?: number;
}

/** Truncated preview, no link. Parents wrap it in a card link to /read/…. */
export function Preview({ text, lines = 6 }: PreviewProps) {
    if (text.length <= 300) {
        return <p className="body-text whitespace-pre-wrap">{text}</p>;
    }

    return (
        <p
            className="body-text whitespace-pre-wrap"
            style={{
                display: "-webkit-box",
                WebkitLineClamp: lines,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
            }}
        >
            {text}
        </p>
    );
}
