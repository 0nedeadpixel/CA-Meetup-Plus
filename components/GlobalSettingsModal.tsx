import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { X, Globe, Link as LinkIcon, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { useToast } from './ToastContext';
import { motion, AnimatePresence } from 'framer-motion';

const MotionDiv = motion.div as any;

interface GlobalSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const GlobalSettingsModal: React.FC<GlobalSettingsModalProps> = ({ isOpen, onClose }) => {
    const [footerText, setFooterText] = useState('Fullerton GO!');
    const [footerLink, setFooterLink] = useState('https://www.instagram.com/fullertonpogo/');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        if (isOpen) {
            const fetchSettings = async () => {
                setLoading(true);
                try {
                    const snap = await getDoc(doc(db, 'global_settings', 'config'));
                    if (snap.exists()) {
                        const data = snap.data();
                        if (data.footerText) setFooterText(data.footerText);
                        if (data.footerLink) setFooterLink(data.footerLink);
                    }
                } catch (e) {
                    console.error(e);
                } finally {
                    setLoading(false);
                }
            };
            fetchSettings();
        }
    }, [isOpen]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await setDoc(doc(db, 'global_settings', 'config'), {
                footerText,
                footerLink
            }, { merge: true });
            addToast('Global settings saved!', 'success');
        } catch (e) {
            console.error(e);
            addToast('Failed to save global settings.', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <MotionDiv 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
            >
                <div className="bg-gray-900 border border-purple-500/30 p-6 w-full max-w-md shadow-2xl relative transition-all duration-300 flex flex-col max-h-[90vh]">
                    <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white z-10">
                        <X size={20} />
                    </button>
                    
                    <div className="flex items-center gap-3 mb-4 shrink-0">
                        <div className="p-2 bg-purple-500/20">
                            <Globe className="text-purple-400" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Global Access</h2>
                            <p className="text-xs text-gray-400">Super Admin Configuration</p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="animate-spin text-purple-500" size={32} />
                                </div>
                            ) : (
                                <div className="space-y-4 mb-6">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Footer "Made with" Text</label>
                                        <input 
                                            type="text" 
                                            value={footerText}
                                            onChange={(e) => setFooterText(e.target.value)}
                                            className="w-full bg-gray-950 border border-gray-800 p-3 focus:border-purple-500 outline-none text-white"
                                            placeholder="e.g. Fullerton GO!"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Footer Link</label>
                                        <div className="relative">
                                            <LinkIcon className="absolute left-3 top-3.5 text-gray-600" size={18} />
                                            <input 
                                                type="url" 
                                                value={footerLink}
                                                onChange={(e) => setFooterLink(e.target.value)}
                                                className="w-full bg-gray-950 border border-gray-800 py-3 pl-10 pr-3 focus:border-purple-500 outline-none text-white"
                                                placeholder="https://..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                        <Button fullWidth onClick={handleSave} disabled={loading || saving} className="bg-purple-600 hover:bg-purple-500 border-none shadow-md">
                            {saving ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Save Global Settings'}
                        </Button>
                    </div>
                </div>
            </MotionDiv>
        </AnimatePresence>
    );
};
