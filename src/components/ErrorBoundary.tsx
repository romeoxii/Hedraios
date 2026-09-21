import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
    children: ReactNode;
}

interface ErrorBoundaryState {
    error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { error: null };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("[hedraios] render crash:", error, info.componentStack);
    }

    private handleRetry = () => {
        this.setState({ error: null });
    };

    private handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.error) {
            return (
                <section className="mx-auto flex min-h-[70svh] w-full max-w-sm flex-col justify-center px-6 py-12 text-center">
                    <h1 className="section-title text-2xl">Something went wrong</h1>
                    <p className="meta mt-2" style={{ fontSize: "0.9375rem" }}>
                        The app hit an unexpected error. Your saved entries are safe — they live in
                        local storage and Supabase.
                    </p>
                    <div className="mt-6 flex justify-center gap-3">
                        <button
                            type="button"
                            onClick={this.handleRetry}
                            className="btn btn-primary"
                        >
                            Try again
                        </button>
                        <button type="button" onClick={this.handleReload} className="btn">
                            Reload
                        </button>
                    </div>
                </section>
            );
        }
        return this.props.children;
    }
}
