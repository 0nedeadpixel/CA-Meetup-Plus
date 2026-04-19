import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, AlertTriangle, XCircle } from 'lucide-react';
import { Button } from './Button';

const MotionDiv = motion.div as any;

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'info' | 'error' | 'warning';
  buttonText?: string;
}

export const InfoModal: React.FC<InfoModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  buttonText = 'Got it'
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <MotionDiv
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <MotionDiv
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className={`bg-gray-900 border border-gray-800  w-full max-w-sm shadow-2xl overflow-hidden ${type === 'error' ? 'border-red-500/20' : type === 'warning' ? 'border-yellow-500/20' : ''}`}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className={`p-3 rounded-full flex items-center justify-center ${
                  type === 'error' ? 'bg-red-500/20 text-red-500' : 
                  type === 'warning' ? 'bg-yellow-500/20 text-yellow-500' : 
                  'bg-primary/20 text-primary'
                }`}>
                  {type === 'error' ? <XCircle size={24} /> : type === 'warning' ? <AlertTriangle size={24} /> : <Info size={24} />}
                </div>
                <h3 className="text-xl font-bold text-white leading-tight">{title}</h3>
              </div>
              
              <div className="text-gray-400 text-sm leading-relaxed mb-6 whitespace-pre-wrap">
                {message}
              </div>

              <Button 
                fullWidth 
                variant={type === 'error' ? "danger" : "primary"} 
                onClick={onClose}
                className="text-sm"
              >
                {buttonText}
              </Button>
            </div>
          </MotionDiv>
        </MotionDiv>
      )}
    </AnimatePresence>
  );
};
