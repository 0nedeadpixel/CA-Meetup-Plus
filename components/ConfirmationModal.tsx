import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

// Fix for framer-motion type mismatch
const MotionDiv = motion.div as any;

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDanger = false
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <MotionDiv
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <MotionDiv
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className={`bg-gray-900 border border-gray-800  w-full max-w-sm shadow-2xl overflow-hidden ${isDanger ? 'border-red-500/20' : ''}`}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className={`p-3 rounded-full flex items-center justify-center ${isDanger ? 'bg-red-500/20 text-red-500' : 'bg-primary/20 text-primary'}`}>
                  <AlertTriangle size={24} />
                </div>
                <h3 className="text-xl font-bold text-white leading-tight">{title}</h3>
              </div>
              
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                {message}
              </p>

              <div className="flex gap-3">
                <Button 
                  fullWidth 
                  variant="secondary" 
                  onClick={onClose}
                  className="text-sm"
                >
                  {cancelText}
                </Button>
                <Button 
                  fullWidth 
                  variant={isDanger ? "danger" : "primary"} 
                  onClick={() => { onConfirm(); onClose(); }}
                  className="text-sm"
                >
                  {confirmText}
                </Button>
              </div>
            </div>
          </MotionDiv>
        </MotionDiv>
      )}
    </AnimatePresence>
  );
};