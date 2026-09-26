import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { AuthGate } from "./components/AuthGate";
import { Homepage } from "./components/Homepage";
import { Notes } from "./components/Notes";
import { Prayers } from "./components/Prayers";
import { ReaderRoute } from "./components/ReaderRoute";
import { Readings } from "./components/Readings";
import { ThemeToggle } from "./components/ThemeToggle";
import { Timeline } from "./components/Timeline";
import { Toaster } from "./components/Toaster";
import { useAuth } from "./hooks/useAuth";
import { useOnline } from "./hooks/useOnline";
import { AuthProvider } from "./lib/auth";
import { buildExport, downloadExport } from "./lib/export";
import { supabase } from "./lib/supabaseClient";

interface TabDef {
    id: string;
    to: string;
    label: string;
    hue: string;
    soft: string;
    icon: ReactNode;
}

function TabIcon({ children }: { children: ReactNode }) {
    return (
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {children}
        </svg>
    );
}

function MenuIcon({ children }: { children: ReactNode }) {
    return (
        <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {children}
        </svg>
    );
}

const TABS: TabDef[] = [
    {
        id: "today",
        to: "/",
        label: "Today",
        hue: "var(--accent)",
        soft: "var(--accent-soft)",
        icon: (
            <TabIcon>
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
            </TabIcon>
        ),
    },
    {
        id: "notes",
        to: "/notes",
        label: "Notes",
        hue: "var(--accent)",
        soft: "var(--accent-soft)",
        icon: (
            <TabIcon>
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </TabIcon>
        ),
    },
    {
        id: "prayers",
        to: "/prayers",
        label: "Prayers",
        hue: "var(--hue-prayer)",
        soft: "var(--hue-prayer-soft)",
        icon: (
            <TabIcon>
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </TabIcon>
        ),
    },
    {
        id: "readings",
        to: "/readings",
        label: "Readings",
        hue: "var(--hue-reading)",
        soft: "var(--hue-reading-soft)",
        icon: (
            <TabIcon>
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </TabIcon>
        ),
    },
];

function Shell() {
    const { user, loading } = useAuth();
    const online = useOnline();
    const [exporting, setExporting] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [authOpen, setAuthOpen] = useState(false);

    async function handleExport() {
        if (!user || exporting) return;
        setExporting(true);
        try {
            downloadExport(await buildExport(user.id));
        } finally {
            setExporting(false);
            setMenuOpen(false);
        }
    }

    async function handleSignOut() {
        setMenuOpen(false);
        await supabase.auth.signOut();
    }

    useEffect(() => {
        if (!menuOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setMenuOpen(false);
        };
        const onScroll = () => setMenuOpen(false);
        window.addEventListener("keydown", onKey);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("scroll", onScroll);
        };
    }, [menuOpen]);

    if (loading) {
        return (
            <section className="mx-auto flex min-h-[70svh] w-full max-w-sm flex-col items-center justify-center gap-3 px-6 text-center">
                <span className="spinner" role="status" aria-label="Loading" />
                <p className="meta">Loading…</p>
            </section>
        );
    }

    if (!user) {
        return authOpen ? (
            <AuthGate onBack={() => setAuthOpen(false)} />
        ) : (
            <Homepage onOpen={() => setAuthOpen(true)} />
        );
    }

    return (
        <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col px-5 pb-2">
            <header className="flex items-center justify-between gap-3 py-5">
                <span className="flex items-center gap-2">
                    <span
                        title={online ? "Online" : "Offline, changes save locally"}
                        style={{
                            background: online ? "var(--ok)" : "var(--warn)",
                        }}
                        className="inline-block h-2 w-2 rounded-full"
                    />
                    <span
                        className="section-title"
                        style={{
                            fontSize: "1.5rem",
                            fontWeight: 800,
                            letterSpacing: "-0.02em",
                        }}
                    >
                        <span
                            style={{
                                background:
                                    "linear-gradient(90deg, var(--accent), var(--hue-reading))",
                                WebkitBackgroundClip: "text",
                                backgroundClip: "text",
                                color: "transparent",
                            }}
                        >
                            Hedraios
                        </span>
                    </span>
                </span>
                <span className="flex items-center gap-2 text-sm">
                    {!online && <span className="meta">Offline</span>}
                    <ThemeToggle />
                    <button
                        type="button"
                        onClick={handleExport}
                        disabled={exporting}
                        title="Download all entries, prayers, and readings as JSON"
                        className="btn btn-sm hide-on-mobile"
                    >
                        {exporting ? "Exporting…" : "Export"}
                    </button>
                    <button
                        type="button"
                        onClick={() => supabase.auth.signOut()}
                        className="btn btn-sm btn-ghost signout hide-on-mobile"
                    >
                        Sign out
                    </button>
                    <button
                        type="button"
                        onClick={() => setMenuOpen((o) => !o)}
                        aria-label="Account menu"
                        aria-expanded={menuOpen}
                        className="btn btn-sm hamburger"
                        style={{ padding: "0.35rem 0.6rem" }}
                    >
                        <svg
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            aria-hidden="true"
                        >
                            <line x1="4" y1="7" x2="20" y2="7" />
                            <line x1="4" y1="12" x2="20" y2="12" />
                            <line x1="4" y1="17" x2="20" y2="17" />
                        </svg>
                    </button>
                </span>
            </header>
            <nav
                aria-label="Sections"
                className="desktop-tabs grid grid-cols-4 gap-1 rounded-2xl p-1 text-sm"
                style={{ background: "var(--field)" }}
            >
                {TABS.map((t) => (
                    <NavLink
                        key={t.id}
                        to={t.to}
                        end={t.to === "/"}
                        className="rounded-xl px-4 py-2 text-center transition-colors"
                        style={({ isActive }) =>
                            isActive
                                ? {
                                      background: t.soft,
                                      color: t.hue,
                                      fontWeight: 600,
                                  }
                                : { color: "var(--muted)", background: "transparent" }
                        }
                    >
                        {t.label}
                    </NavLink>
                ))}
            </nav>
            <main className="app-main flex flex-1 flex-col">
                <AnimatedRoutes userId={user.id} />
            </main>
            <Toaster />
            <footer className="app-footer meta">Hedraios · your data stays yours</footer>
            <nav className="mobile-bottom-nav" aria-label="Sections">
                {TABS.map((t) => (
                    <NavLink
                        key={t.id}
                        to={t.to}
                        end={t.to === "/"}
                        aria-label={t.label}
                        className="mobile-bottom-tab"
                        style={({ isActive }) => ({
                            color: isActive ? t.hue : "var(--muted)",
                        })}
                    >
                        {t.icon}
                        <span>{t.label}</span>
                    </NavLink>
                ))}
            </nav>
            {menuOpen && (
                <>
                    <div
                        role="presentation"
                        onMouseDown={() => setMenuOpen(false)}
                        style={{ position: "fixed", inset: 0, zIndex: 45 }}
                    />
                    <div className="menu-panel" role="menu" aria-label="Account menu">
                        <button
                            type="button"
                            role="menuitem"
                            onClick={handleExport}
                            disabled={exporting}
                            className="btn"
                        >
                            <MenuIcon>
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </MenuIcon>
                            <span>{exporting ? "Exporting…" : "Export data"}</span>
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            onClick={handleSignOut}
                            className="btn btn-ghost signout"
                        >
                            <MenuIcon>
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </MenuIcon>
                            <span>Sign out</span>
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

function BootScreen() {
    const [fading, setFading] = useState(false);
    const [gone, setGone] = useState(false);

    useEffect(() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        // Shows on every load. The phone's own splash only shows for installed apps.
        const showMs = reduce ? 0 : 1100;
        const fadeMs = reduce ? 0 : 400;
        const t1 = window.setTimeout(() => setFading(true), showMs);
        const t2 = window.setTimeout(() => setGone(true), showMs + fadeMs);
        return () => {
            window.clearTimeout(t1);
            window.clearTimeout(t2);
        };
    }, []);

    if (gone) return null;

    return (
        <div
            aria-hidden="true"
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 200,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.9rem",
                background: "var(--bg)",
                opacity: fading ? 0 : 1,
                transition: "opacity 0.4s ease",
                pointerEvents: fading ? "none" : "auto",
            }}
        >
            <img
                src="/favicon.png"
                alt=""
                width={72}
                height={72}
                style={{ borderRadius: "18px" }}
            />
            <p className="section-title" style={{ fontSize: "1.5rem", fontWeight: 800 }}>
                Hedraios
            </p>
            <span className="spinner" />
        </div>
    );
}

function AnimatedRoutes({ userId }: { userId: string }) {
    const location = useLocation();

    // Fresh top on every page. Instant jump, never smooth-scroll fighting
    // the enter animation.
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [location.pathname]);

    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="flex flex-1 flex-col"
            >
                <Routes location={location}>
                    <Route path="/" element={<Timeline userId={userId} />} />
                    <Route path="/notes" element={<Notes userId={userId} />} />
                    <Route path="/prayers" element={<Prayers userId={userId} />} />
                    <Route path="/readings" element={<Readings userId={userId} />} />
                    <Route path="/read/:kind/:id" element={<ReaderRoute />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </motion.div>
        </AnimatePresence>
    );
}

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                {/* Reduced-motion users get instant page swaps, no slides. */}
                <MotionConfig reducedMotion="user">
                    <BootScreen />
                    <Shell />
                </MotionConfig>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
