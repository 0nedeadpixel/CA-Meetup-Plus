import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, Database, Eye, Trash2, Info, Lock } from 'lucide-react';
import { Button } from './Button';

// Fix for framer-motion type mismatch
const MotionDiv = motion.div as any;

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose }) => {
  const [confirmWipe, setConfirmWipe] = useState(false);

  const handleWipe = () => {
      localStorage.clear();
      window.location.reload();
  };

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
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-gray-900 border border-gray-800 w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10">
                  <ShieldCheck className="text-primary" size={24} />
                </div>
                <h2 className="text-xl font-bold text-white">Privacy Policy</h2>
              </div>
              <button onClick={onClose} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-sm text-gray-300 leading-relaxed">
              <section>
                <h3 className="text-white font-bold flex items-center gap-2 mb-2">
                  <Database size={16} className="text-blue-400" /> Data Collection
                </h3>
                <p>We collect minimal data to provide event services. This includes:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-2 text-gray-400">
                  <li><strong>Device ID:</strong> A randomly generated ID stored locally to prevent duplicate entries and ensure fair play.</li>
                  <li><strong>Player Details:</strong> Your In-Game Name (IGN) and Nickname, provided by you when joining a raffle or game.</li>
                  <li><strong>Admin Email:</strong> Only if you are an authorized Ambassador/Host.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-white font-bold flex items-center gap-2 mb-2">
                  <Eye size={16} className="text-purple-400" /> Usage of Data
                </h3>
                <p>Your data is strictly used for:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-2 text-gray-400">
                  <li>Identifying winners in Raffles and Trivia.</li>
                  <li>Tracking progress in Scavenger Hunts.</li>
                  <li>Ensuring a 1-code-per-person limit in the Distributor.</li>
                </ul>
                <p className="mt-2 text-xs italic text-gray-500">We never sell your data or use it for marketing purposes.</p>
              </section>

              <section>
                <h3 className="text-white font-bold flex items-center gap-2 mb-2">
                  <Lock size={16} className="text-green-400" /> Third-Party Services
                </h3>
                <p>This application uses <strong>Google Firebase</strong> for real-time data synchronization and secure cloud storage. By using this tool, you acknowledge that your data is processed by Google in accordance with their privacy standards.</p>
              </section>

              <section className="bg-gray-950 p-4 border border-gray-800">
                <h3 className="text-white font-bold flex items-center gap-2 mb-2 text-red-400">
                  <Trash2 size={16} /> Your Rights
                </h3>
                <p className="text-xs mb-3">Under GDPR, you have the right to access, rectify, or delete your data. You can wipe your local records below.</p>
                
                {!confirmWipe ? (
                    <Button 
                        fullWidth 
                        variant="secondary" 
                        onClick={() => setConfirmWipe(true)}
                        className="h-10 text-xs border-red-500/20 text-red-400 hover:bg-red-500/10"
                    >
                        Delete My Local Data
                    </Button>
                ) : (
                    <div className="space-y-2 animate-fade-in-up">
                        <div className="text-xs text-red-400 font-bold text-center">Are you sure? This cannot be undone.</div>
                        <div className="flex gap-2">
                            <Button fullWidth variant="secondary" onClick={() => setConfirmWipe(false)} className="h-10 text-xs">Cancel</Button>
                            <Button fullWidth variant="danger" onClick={handleWipe} className="h-10 text-xs">Yes, Delete</Button>
                        </div>
                    </div>
                )}
              </section>

              <div className="text-[10px] text-gray-500 text-center pt-4 italic">
                Last Updated: April 2026 • Version 2.415
              </div>
            </div>

            <div className="p-6 border-t border-gray-800 bg-gray-900/50">
              <Button fullWidth onClick={onClose}>I Understand</Button>
            </div>
          </MotionDiv>
        </MotionDiv>
      )}
    </AnimatePresence>
  );
};