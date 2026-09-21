import { Link, useNavigate, useParams } from "react-router-dom";
import { ReaderView } from "./ReaderView";
import { resolveReading } from "../lib/reading";
import { useAuth } from "../hooks/useAuth";
import { useEntries } from "../hooks/useEntries";
import { usePrayers } from "../hooks/usePrayers";
import { useReadings } from "../hooks/useReadings";

export function ReaderRoute() {
    const { kind, id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const userId = user?.id;
    const { entries, loading: entriesLoading } = useEntries(userId);
    const { prayers, loading: prayersLoading } = usePrayers(userId);
    const { readings, loading: readingsLoading } = useReadings(userId);

    function goBack() {
        if (window.history.length > 1) navigate(-1);
        else navigate("/");
    }

    if (entriesLoading || prayersLoading || readingsLoading) {
        return <p className="meta py-12 text-center">Loading…</p>;
    }

    const numericId = Number(id);
    const model =
        Number.isInteger(numericId) && numericId > 0
            ? resolveReading(kind, numericId, { entries, prayers, readings })
            : null;

    if (!model) {
        return (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
                <p className="section-title text-xl">Not found</p>
                <p className="meta">This item may have been deleted.</p>
                <Link to="/" className="btn btn-sm">
                    Back to Today
                </Link>
            </div>
        );
    }

    return (
        <ReaderView
            backLabel="back"
            onBack={goBack}
            eyebrow={model.eyebrow}
            title={model.title}
            dateLabel={model.dateLabel}
            body={model.body}
            tags={model.tags}
        />
    );
}
