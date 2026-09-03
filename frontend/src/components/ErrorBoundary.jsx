import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Unhandled React Error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        window.location.href = '/dashboard';
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
                    <div className="bg-white max-w-lg w-full rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xl text-center space-y-4">
                        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto border border-amber-200">
                            <AlertTriangle size={32} />
                        </div>

                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Something went wrong</h2>
                            <p className="text-sm text-slate-500 mt-1">
                                An unexpected UI rendering error occurred on this page. We've caught it so you don't see a blank screen.
                            </p>
                        </div>

                        {this.state.error?.message && (
                            <div className="bg-slate-100 p-3 rounded-lg text-left text-xs font-mono text-slate-700 overflow-x-auto max-h-32">
                                {this.state.error.toString()}
                            </div>
                        )}

                        <div className="flex items-center justify-center gap-3 pt-2">
                            <button
                                onClick={this.handleReload}
                                className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 flex items-center gap-2 shadow-sm transition"
                            >
                                <RefreshCw size={14} /> Refresh Page
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                className="px-4 py-2 border border-slate-200 bg-white text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 flex items-center gap-2 transition"
                            >
                                <Home size={14} /> Back to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
