import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
 constructor(props) {
 super(props);
 this.state = { hasError: false, error: null };
 }

 static getDerivedStateFromError(error) {
 return { hasError: true, error };
 }

 componentDidCatch(error, errorInfo) {
 console.error('ErrorBoundary caught:', error, errorInfo);
 }

 render() {
 if (this.state.hasError) {
 return (
 <div className="flex items-center justify-center min-h-[300px] p-6">
 <div className="text-center max-w-md">
 <AlertTriangle size={48} className="mx-auto text-red-400 mb-4" />
 <h2 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h2>
 <p className="text-sm text-gray-500 mb-4">
 {this.state.error?.message || 'An unexpected error occurred.'}
 </p>
 <button
 onClick={() => {
 this.setState({ hasError: false, error: null });
 window.location.reload();
 }}
 className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
 >
 <RefreshCw size={14} /> Reload Page
 </button>
 </div>
 </div>
 );
 }
 return this.props.children;
 }
}
