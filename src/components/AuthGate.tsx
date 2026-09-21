import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import { ThemeToggle } from "./ThemeToggle";

type Status = "idle" | "sending" | "sent" | "error";

/** Shows j•••@x.com instead of the full address. Recognizable, not exposed. */
function maskEmail(email: string): string {
    const [local, domain] = email.split("@");
    if (!domain || local.length === 0) return email;
    const head = local.length <= 3 ? local.slice(0, 1) : local.slice(0, 3);
    return `${head}•••@${domain}`;
}

export function AuthGate() {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<Status>("idle");
    const [error, setError] = useState("");
    const [code, setCode] = useState("");
    const [verifying, setVerifying] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const cooldownTimer = useRef<number | null>(null);
    const emailEmpty = !email.trim();
    const busy = status === "sending";

    useEffect(
        () => () => {
            if (cooldownTimer.current != null) {
                window.clearInterval(cooldownTimer.current);
            }
        },
        [],
    );

    // Code-only login: request a code, type it here. No links, no passwords.
    async function verifyCode(e?: FormEvent) {
        e?.preventDefault();
        const token = code.trim();
        if (token.length < 6 || verifying) return;
        setVerifying(true);
        setError("");
        const { error: verifyError } = await supabase.auth.verifyOtp({
            email: email.trim(),
            token,
            type: "email",
        });
        setVerifying(false);
        if (verifyError) {
            setError(verifyError.message);
            return;
        }
        // Good code signs straight in.
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!email.trim()) return;
        setStatus("sending");
        setError("");
        setCode("");
        const { error: otpError } = await supabase.auth.signInWithOtp({
            email: email.trim(),
        });
        if (otpError) {
            setError(otpError.message);
            setStatus("error");
        } else {
            setStatus("sent");
            startCooldown();
        }
    }

    // Resends cost emails (2 an hour on the free sender), so repeats wait 60s.
    function startCooldown() {
        if (cooldownTimer.current != null) {
            window.clearInterval(cooldownTimer.current);
        }
        setCooldown(60);
        cooldownTimer.current = window.setInterval(() => {
            setCooldown((c) => {
                if (c <= 1) {
                    if (cooldownTimer.current != null) {
                        window.clearInterval(cooldownTimer.current);
                        cooldownTimer.current = null;
                    }
                    return 0;
                }
                return c - 1;
            });
        }, 1000);
    }

    async function resendCode() {
        if (cooldown > 0 || busy) return;
        setStatus("sending");
        setError("");
        setCode("");
        const { error: otpError } = await supabase.auth.signInWithOtp({
            email: email.trim(),
        });
        if (otpError) {
            setError(otpError.message);
            setStatus("error");
        } else {
            setStatus("sent");
            startCooldown();
        }
    }

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

            <div className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center pb-16 text-center">
                {status === "error" && error && (
                    <p className="alert-error mb-5 mt-5 text-left">{error}</p>
                )}

                {status === "sent" ? (
                    <div className="card mt-6 flex flex-col items-center px-6 py-8 text-center">
                        <span
                            className="flex h-12 w-12 items-center justify-center rounded-full"
                            style={{ background: "var(--accent-soft)" }}
                            aria-hidden="true"
                        >
                            <svg
                                width="22"
                                height="22"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="var(--accent)"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <rect x="2" y="4" width="20" height="16" rx="3" />
                                <path d="m2 7 10 6L22 7" />
                            </svg>
                        </span>
                        <p className="section-title mt-4" style={{ fontSize: "1.1rem" }}>
                            Enter your code
                        </p>
                        <p className="meta mt-2" style={{ fontSize: "0.875rem" }}>
                            Sent to{" "}
                            <strong style={{ color: "var(--text)" }}>
                                {maskEmail(email.trim())}
                            </strong>{" "}
                            — check spam, it expires soon.
                        </p>
                        <form onSubmit={verifyCode} className="mt-5 flex w-full flex-col gap-3">
                            <input
                                value={code}
                                onChange={(e) =>
                                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                                }
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                placeholder="6-digit code"
                                aria-label="6-digit code from the email"
                                className="field w-full text-center"
                                style={{ letterSpacing: "0.2em" }}
                            />
                            <button
                                type="submit"
                                disabled={code.trim().length < 6 || verifying}
                                className="btn btn-primary w-full font-semibold"
                                style={{
                                    borderRadius: "999px",
                                    padding: "0.65rem 1rem",
                                    fontSize: "0.9375rem",
                                }}
                            >
                                {verifying ? "Verifying…" : "Verify"}
                            </button>
                        </form>
                        {error && <p className="alert-error mt-3 w-full text-left">{error}</p>}
                        <p className="meta mt-4" style={{ fontSize: "0.8125rem" }}>
                            No code yet?{" "}
                            <button
                                type="button"
                                onClick={resendCode}
                                disabled={cooldown > 0 || busy}
                                className="link-btn"
                                style={{ fontSize: "inherit" }}
                            >
                                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                            </button>
                        </p>
                    </div>
                ) : (
                    <>
                        <h1
                            className="mt-2"
                            style={{
                                fontSize: "1.65rem",
                                fontWeight: 700,
                                letterSpacing: "-0.02em",
                                color: "var(--text)",
                            }}
                        >
                            Welcome back
                        </h1>
                        <p
                            className="meta mt-3"
                            style={{
                                fontSize: "0.875rem",
                                fontWeight: 400,
                                fontFamily: '"Inter", system-ui, sans-serif',
                            }}
                        >
                            Your journal, prayers, and readings are waiting.
                        </p>
                        <form onSubmit={handleSubmit} className="mt-7 flex w-full flex-col gap-3">
                            <input
                                type="email"
                                required
                                autoComplete="email"
                                placeholder="Enter email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="field text-center"
                                style={{ borderRadius: "14px", padding: "0.65rem 1rem" }}
                            />
                            <button
                                type="submit"
                                disabled={busy || emailEmpty}
                                className="btn btn-primary w-full font-semibold"
                                style={{
                                    borderRadius: "999px",
                                    padding: "0.65rem 1rem",
                                    fontSize: "0.9375rem",
                                }}
                            >
                                {status === "sending" ? "Sending…" : "Continue"}
                            </button>
                        </form>
                        <p className="meta mt-8" style={{ fontSize: "0.8125rem" }}>
                            We&apos;ll email you a 6-digit code — no password to remember.
                        </p>
                    </>
                )}
            </div>
            {verifying && (
                <div
                    role="status"
                    aria-label="Verifying code"
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
                    }}
                >
                    <img
                        src="/favicon.png"
                        alt=""
                        width={64}
                        height={64}
                        style={{ borderRadius: "16px" }}
                    />
                    <p className="section-title" style={{ fontSize: "1.25rem" }}>
                        Hedraios
                    </p>
                    <span className="spinner" />
                </div>
            )}
        </section>
    );
}
