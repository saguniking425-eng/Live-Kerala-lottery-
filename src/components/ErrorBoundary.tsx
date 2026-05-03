import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught rendering error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 border-4 border-red-500 bg-red-50 text-red-900 font-mono flex flex-col items-center justify-center min-h-[40vh]">
            <h2 className="text-2xl font-bold uppercase mb-4">Rendering Error Detected</h2>
            <p className="max-w-md text-center">Something went wrong in the component tree. This prevents the UI from rendering correctly. Please refresh the page.</p>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

export default ErrorBoundary;
