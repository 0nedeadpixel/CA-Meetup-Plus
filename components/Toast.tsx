
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle } from 'lucide-react';

// Fix for framer-motion type mismatch
const MotionDiv = motion.div as any;

interface ToastProps {
  message: string;
  isOpen: boolean;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, isOpen, onClose, duration = 3000 }) => {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <MotionDiv
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-6 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 z-[100] flex justify-center pointer-events-none"
        >
          <div className="bg-gradient-to-r from-primary to-orange-600 text-white px-6 py-4 shadow-2xl flex items-center gap-3 border border-white/10 backdrop-blur-md pointer-events-auto">
            <CheckCircle className="text-white fill-white/20" size={24} />
            <span className="font-bold text-sm tracking-wide">{message}</span>
          </div>
        </MotionDiv>
      )}
    </AnimatePresence>
  );
};
