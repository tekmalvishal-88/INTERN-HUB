import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let displayMsg = 'An unexpected error occurred while loading your workspace.';
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string };
      if (parsed && parsed.error) {
        displayMsg = `Could not complete data ${parsed.operationType || 'request'}. Please refresh and sign in again.`;
      }
    } catch {
      if (error.message) {
        displayMsg = error.message;
      }
    }
    return { hasError: true, message: displayMsg };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('InternHub ErrorBoundary caught error:', error, info);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f3f6fb] dark:bg-[#0b1120] text-[#12203a] dark:text-[#e8eefc] flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] p-6 space-y-4 shadow-sm">
            <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-extrabold tracking-tight">Something went wrong</h2>
              <p className="text-sm text-[#5b6b86] dark:text-[#9fb0cc] leading-relaxed">
                {this.state.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2f5bea] hover:bg-[#244bc9] text-white text-sm font-bold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reload InternHub</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
