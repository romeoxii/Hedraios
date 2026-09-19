import { useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";

type Status = "idle" | "sending" | "sent" | "error";

export function AuthGate() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    setError("");
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (otpError) {
      setError(otpError.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  return (
    <section className="mx-auto flex min-h-[70svh] w-full max-w-sm flex-col justify-center px-6 py-12 text-center">
      <h1 className="text-3xl font-medium tracking-tight">Hedraios</h1>
      <p className="mt-2 text-sm opacity-70">
        Daily documentation + faith tracking. Sign in with a magic link.
      </p>
      {status === "sent" ? (
        <p className="mt-6 rounded-lg border p-4 text-sm">
          Check your inbox — a sign-in link is on its way to{" "}
          <strong>{email.trim()}</strong>.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border bg-transparent px-4 py-2.5 text-base outline-none focus:ring-2"
          />
          <button
            type="submit"
            disabled={status === "sending" || !email.trim()}
            className="rounded-lg border px-4 py-2.5 text-base font-medium disabled:opacity-50"
          >
            {status === "sending" ? "Sending…" : "Send magic link"}
          </button>
          {status === "error" && error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
        </form>
      )}
    </section>
  );
}
