import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

export interface AuthContextValue {
    session: Session | null;
    user: User | null;
    loading: boolean;
    /** Re-checks the login (catches sign-ins from another tab). */
    refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
    session: null,
    user: null,
    loading: true,
    refresh: async () => {},
});
