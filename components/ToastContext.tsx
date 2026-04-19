import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3  shadow-2xl border min-w-[300px] max-w-md ${
                toast.type === 'success' ? 'bg-green-950/90 border-green-500/30 text-green-400' :
                toast.type === 'error' ? 'bg-red-950/90 border-red-500/30 text-red-400' :
                toast.type === 'warning' ? 'bg-yellow-950/90 border-yellow-500/30 text-yellow-400' :
                'bg-gray-900/90 border-gray-700 text-gray-200'
              } backdrop-blur-md`}
            >
              <div className="shrink-0">
                {toast.type === 'success' && <CheckCircle size={20} />}
                {toast.type === 'error' && <XCircle size={20} />}
                {toast.type === 'warning' && <AlertTriangle size={20} />}
                {toast.type === 'info' && <Info size={20} />}
              </div>
              <p className="text-sm font-medium flex-1">{toast.message}</p>
              <button onClick={() => removeToast(toast.id)} className="shrink-0 opacity-50 hover:opacity-100 transition-opacity">
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
