import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-xl border border-white-light dark:border-dark bg-white dark:bg-black">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {this.props.fallbackTitle ?? 'Something went wrong'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {this.props.fallbackMessage ?? 'An error occurred. Please try again or go back to the dashboard.'}
          </p>
          <Link
            to="/app/dashboard"
            className="inline-block px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            Back to Dashboard
          </Link>
        </div>
      );
    }
    return this.props.children;
  }
}
