import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import { AuthContext } from "./authContext";

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        const { data } = await supabase.auth.getSession();
        setSession(data.session);
        setLoading(false);
    }, []);

    useEffect(() => {
        // Checks the login on open. Lint rule silenced below on purpose.
        // oxlint-disable-next-line react/set-state-in-effect
        refresh();
        const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            setSession(nextSession);
            setLoading(false);
        });
        return () => {
            listener.subscription.unsubscribe();
        };
    }, [refresh]);

    return (
        <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, refresh }}>
            {children}
        </AuthContext.Provider>
    );
}
