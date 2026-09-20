import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[hedraios] render crash:', error, info.componentStack)
  }

  private handleRetry = () => {
    this.setState({ error: null })
  }

  private handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      return (
        <section className="mx-auto flex min-h-[70svh] w-full max-w-sm flex-col justify-center px-6 py-12 text-center">
          <h1 className="text-2xl font-medium tracking-tight">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm opacity-70">
            The app hit an unexpected error. Your saved entries are safe —
            they live in local storage and Supabase.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className="rounded-lg border px-4 py-2 text-sm font-medium"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="rounded-lg border px-4 py-2 text-sm opacity-70"
            >
              Reload
            </button>
          </div>
        </section>
      )
    }
    return this.props.children
  }
}
