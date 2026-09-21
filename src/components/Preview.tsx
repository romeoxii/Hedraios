import { Link } from "react-router-dom";

interface PreviewProps {
    text: string;
    /** Where Read more goes, like `/read/entry/3`. */
    to: string;
    lines?: number;
}

/** Short preview with a Read more link. Short text shows plain, no link.
 *  Full reading lives on its own page, never in lists. */
export function Preview({ text, to, lines = 6 }: PreviewProps) {
    if (text.length <= 300) {
        return <p className="body-text whitespace-pre-wrap">{text}</p>;
    }

    return (
        <div>
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
            <Link to={to} className="link-btn mt-1" style={{ fontSize: "0.75rem" }}>
                Read more
            </Link>
        </div>
    );
}
