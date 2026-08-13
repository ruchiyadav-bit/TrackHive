import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
 success: CheckCircle,
 error: AlertCircle,
 info: Info,
};

const COLORS = {
 success: 'bg-green-50 border-green-200 text-green-800',
 error: 'bg-red-50 border-red-200 text-red-800',
 info: 'bg-blue-50 border-blue-200 text-blue-800',
};

function ToastItem({ toast, onDismiss }) {
 const Icon = ICONS[toast.type] || Info;

 useEffect(() => {
 const timer = setTimeout(() => onDismiss(toast.id), toast.duration || 4000);
 return () => clearTimeout(timer);
 }, [toast.id, toast.duration, onDismiss]);

 return (
 <div className={`flex items-start gap-2 px-4 py-3 rounded-lg border shadow-lg animate-slide-in ${COLORS[toast.type] || COLORS.info}`}>
 <Icon size={16} className="mt-0.5 shrink-0" />
 <p className="text-sm flex-1">{toast.message}</p>
 <button onClick={() => onDismiss(toast.id)} className="shrink-0 opacity-60 hover:opacity-100">
 <X size={14} />
 </button>
 </div>
 );
}

export function ToastProvider({ children }) {
 const [toasts, setToasts] = useState([]);

 const addToast = useCallback((message, type = 'info', duration = 4000) => {
 const id = Date.now() + Math.random();
 setToasts(prev => [...prev, { id, message, type, duration }]);
 }, []);

 const dismiss = useCallback((id) => {
 setToasts(prev => prev.filter(t => t.id !== id));
 }, []);

 const toast = {
 success: useCallback((msg) => addToast(msg, 'success'), [addToast]),
 error: useCallback((msg) => addToast(msg, 'error'), [addToast]),
 info: useCallback((msg) => addToast(msg, 'info'), [addToast]),
 };

 return (
 <ToastContext.Provider value={toast}>
 {children}
 {/* Toast container */}
 <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
 {toasts.map(t => (
 <div key={t.id} className="pointer-events-auto">
 <ToastItem toast={t} onDismiss={dismiss} />
 </div>
 ))}
 </div>
 </ToastContext.Provider>
 );
}

export function useToast() {
 const ctx = useContext(ToastContext);
 if (!ctx) {
 // Return no-op if outside provider
 return { success: () => {}, error: () => {}, info: () => {} };
 }
 return ctx;
}
