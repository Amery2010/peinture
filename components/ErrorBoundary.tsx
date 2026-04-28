import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { useSettingsStore } from "../store/settingsStore";
import { translations, Language } from "../translations";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary — catches render errors and displays a recovery UI.
 * Prevents the entire app from going blank on component-level errors.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Read language directly from store state for the error boundary
      let language: Language = "en";
      try {
        language = useSettingsStore.getState().language;
      } catch {
        // Fallback to en if store isn't available
      }
      const t = translations[language];

      return (
        <div className="flex items-center justify-center min-h-[50vh] p-8">
          <div className="max-w-md w-full bg-[#1A1625] border border-white/10 rounded-2xl p-8 shadow-2xl text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">
                {t.error_boundary_title || "Something went wrong"}
              </h2>
              <p className="text-sm text-white/50 leading-relaxed">
                {t.error_boundary_desc ||
                  "An unexpected error occurred. You can try refreshing or click the button below to recover."}
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <p className="text-xs font-mono text-red-300/80 break-all line-clamp-3">
                  {this.state.error instanceof Error
                    ? this.state.error.message
                    : String(this.state.error)}
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                aria-label={t.error_boundary_try_again || "Try Again"}
                className="flex items-center gap-2 px-5 py-2.5 bg-purple-600/80 hover:bg-purple-600 text-white rounded-xl text-sm font-medium transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                {t.error_boundary_try_again || "Try Again"}
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl text-sm font-medium transition-colors border border-white/10"
              >
                {t.error_boundary_refresh || "Refresh Page"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
