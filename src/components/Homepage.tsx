import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { ThemeToggle } from "./ThemeToggle";

const FEATURES = [
    {
        hue: "var(--accent)",
        title: "Notes",
        body: "Timestamped entries with mood and tags. Searchable forever.",
    },
    {
        hue: "var(--hue-prayer)",
        title: "Prayers",
        body: "Requests tracked from open to answered.",
    },
    {
        hue: "var(--hue-reading)",
        title: "Readings",
        body: "A scripture log, grouped by day.",
    },
];

const STEPS = ["Write", "Syncs when online", "Yours forever"];

// Step-by-step entrance: parent staggers, each block rises in turn.
const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};

const item: Variants = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

export function Homepage({ onOpen }: { onOpen: () => void }) {
    return (
        <section className="mx-auto flex min-h-svh w-full flex-col px-6 pb-12">
            <div className="flex items-center justify-between py-5">
                <span
                    className="section-title"
                    style={{
                        fontSize: "1.4rem",
                        fontWeight: 800,
                        letterSpacing: "-0.02em",
                        background: "linear-gradient(90deg, var(--accent), var(--hue-reading))",
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        color: "transparent",
                    }}
                >
                    Hedraios
                </span>
                <ThemeToggle />
            </div>

            <motion.div
                className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center pb-10 text-center"
                variants={container}
                initial="hidden"
                animate="show"
            >
                <motion.div variants={item} className="flex justify-center">
                    <img
                        src="/favicon.png"
                        alt="Hedraios mark"
                        width={48}
                        height={48}
                        style={{ borderRadius: "12px" }}
                    />
                </motion.div>
                <motion.h1
                    variants={item}
                    className="my-6"
                    style={{
                        fontSize: "2rem",
                        fontWeight: 600,
                        letterSpacing: "-0.02em",
                        lineHeight: 1.2,
                        color: "var(--text)",
                    }}
                >
                    A calm home for daily faith journaling
                </motion.h1>
                <motion.p
                    variants={item}
                    className="meta mx-auto mt-2"
                    style={{ fontSize: "0.8125rem", maxWidth: "22rem" }}
                >
                    Notes, prayers, and scripture readings
                    <br />
                    saved instantly, synced privately, readable anywhere.
                </motion.p>
                <motion.div variants={item} className="mt-7">
                    <button
                        type="button"
                        onClick={onOpen}
                        className="btn btn-primary font-semibold"
                        style={{
                            borderRadius: "999px",
                            padding: "0.55rem 1.75rem",
                            fontSize: "0.9375rem",
                        }}
                    >
                        Sign in
                    </button>
                </motion.div>

                <motion.div variants={item} className="mt-10 flex flex-col gap-2 text-left">
                    {FEATURES.map((f, i) => (
                        <motion.div
                            key={f.title}
                            className="card flex items-start gap-3"
                            style={{ padding: "0.7rem 0.85rem" }}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.45 + i * 0.08, duration: 0.3 }}
                        >
                            <span
                                aria-hidden="true"
                                style={{
                                    width: "0.6rem",
                                    height: "0.6rem",
                                    borderRadius: "50%",
                                    background: f.hue,
                                    flexShrink: 0,
                                    marginTop: "0.4rem",
                                }}
                            />
                            <span>
                                <span
                                    className="section-title block"
                                    style={{ fontSize: "0.9375rem" }}
                                >
                                    {f.title}
                                </span>
                                <span className="meta" style={{ fontSize: "0.8125rem" }}>
                                    {f.body}
                                </span>
                            </span>
                        </motion.div>
                    ))}
                </motion.div>

                <motion.div
                    variants={item}
                    className="meta mt-8 flex items-center justify-center gap-2"
                    style={{ fontSize: "0.8125rem" }}
                >
                    {STEPS.map((s, i) => (
                        <span key={s} className="flex items-center gap-2">
                            {i > 0 && <span aria-hidden="true">·</span>}
                            <span>{s}</span>
                        </span>
                    ))}
                </motion.div>

                <motion.p
                    variants={item}
                    className="meta mt-4"
                    style={{ fontSize: "0.8125rem" }}
                >
                    On your phone: Share → Add to Home Screen for the full app.
                </motion.p>
            </motion.div>

            <footer className="meta pb-2 text-center">Hedraios · your data stays yours</footer>
        </section>
    );
}
