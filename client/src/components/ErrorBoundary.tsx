import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  eventId?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Forward to Sentry if available at runtime
    const Sentry = (window as any).__Sentry__;
    if (Sentry?.captureException) {
      const id = Sentry.captureException(error, { extra: info });
      this.setState({ eventId: id });
    }
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 text-center">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="text-muted-foreground max-w-md">
          An unexpected error occurred. Reload the page to continue.
          {this.state.eventId && (
            <span className="block mt-1 text-xs text-muted-foreground/60">
              Error ID: {this.state.eventId}
            </span>
          )}
        </p>
        <button
          className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium"
          onClick={() => window.location.reload()}
        >
          Reload page
        </button>
      </div>
    );
  }
}
