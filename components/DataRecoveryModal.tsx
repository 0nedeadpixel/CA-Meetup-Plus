import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, AlertCircle, Loader2, Upload, CheckCircle2 } from 'lucide-react';
import { Button } from './Button';
// @ts-ignore
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface DataRecoveryModalProps {
    isOpen: boolean;
    onClose: () => void;
    communityName: string;
    onRecoverCodes?: (codes: { code: string, ign: string, date: string, source: string }[]) => { imported: number, duplicates: number };
}

export const DataRecoveryModal: React.FC<DataRecoveryModalProps> = ({ isOpen, onClose, communityName, onRecoverCodes }) => {
    const [activeTab, setActiveTab] = useState<'request' | 'import'>('request');
    const [discordHandle, setDiscordHandle] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState('');
    const [importStats, setImportStats] = useState<{ imported: number, skipped: number } | null>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const csvText = event.target?.result as string;
                const lines = csvText.split('\n').filter(line => line.trim() !== '');
                
                // Skip header row if it exists
                const startIndex = lines[0].toLowerCase().includes('code') ? 1 : 0;
                
                const parsedCodes: { code: string, ign: string, date: string, source: string }[] = [];

                for (let i = startIndex; i < lines.length; i++) {
                    const parts = lines[i].split(',');
                    if (parts.length >= 1) {
                        const code = parts[0].trim();
                        if (code) {
                            parsedCodes.push({
                                code: code,
                                ign: parts[1]?.trim() || 'Unknown',
                                date: parts[2]?.replace(/['"]/g, '')?.trim() || new Date().toISOString(),
                                source: parts[3]?.trim() || 'direct_scan'
                            });
                        }
                    }
                }

                if (onRecoverCodes) {
                    const stats = onRecoverCodes(parsedCodes);
                    setImportStats({ imported: stats.imported, skipped: stats.duplicates });
                } else {
                    // Fallback if not provided
                    let imported = 0;
                    let skipped = 0;
                    for (const pc of parsedCodes) {
                        const key = `pogo_claim_recovered_${pc.code}`;
                        if (!localStorage.getItem(key)) {
                            localStorage.setItem(key, pc.code);
                            imported++;
                        } else {
                            skipped++;
                        }
                    }
                    setImportStats({ imported, skipped });
                }
                
                setError('');
            } catch (err) {
                console.error("Error parsing CSV:", err);
                setError("Failed to parse the CSV file. Please ensure it's the correct format.");
            }
        };
        reader.readAsText(file);
    };

    const handleSubmit = async () => {
        if (!discordHandle.trim()) {
            setError('Please enter your Discord handle.');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            await addDoc(collection(db, 'recovery_requests'), {
                communityName: communityName || 'Unknown Community',
                discordHandle: discordHandle.trim(),
                status: 'pending',
                createdAt: serverTimestamp()
            });
            setIsSuccess(true);
        } catch (e: any) {
            console.error('Failed to submit recovery request:', e);
            setError('Failed to submit request. Please try again or contact an admin directly.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!isSubmitting) {
            setIsSuccess(false);
            setDiscordHandle('');
            setError('');
            setImportStats(null);
            setActiveTab('request');
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={handleClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-gray-900 border border-gray-800 w-full max-w-md overflow-hidden shadow-2xl"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            Data Recovery
                        </h2>
                        <button onClick={handleClose} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex border-b border-gray-800 bg-gray-900">
                        <button 
                            className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'request' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-900/10' : 'text-gray-500 hover:text-gray-300'}`}
                            onClick={() => { setActiveTab('request'); setError(''); setImportStats(null); }}
                        >
                            Request Backup
                        </button>
                        <button 
                            className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'import' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-900/10' : 'text-gray-500 hover:text-gray-300'}`}
                            onClick={() => { setActiveTab('import'); setError(''); }}
                        >
                            Import CSV
                        </button>
                    </div>

                    <div className="p-6 space-y-4">
                        {activeTab === 'request' ? (
                            isSuccess ? (
                            <div className="text-center space-y-4 py-4">
                                <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Send size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-white">Request Submitted!</h3>
                                <p className="text-gray-400 text-sm">
                                    Please DM <strong className="text-white">0neDeadPixel</strong> on the CA Discord to verify your identity and receive your recovery file.
                                </p>
                                <Button fullWidth onClick={handleClose} className="mt-4">Close</Button>
                            </div>
                        ) : (
                            <>
                                <div className="bg-blue-900/20 border border-blue-900/30 p-4 flex items-start gap-3">
                                    <AlertCircle className="text-blue-400 shrink-0 mt-0.5" size={18} />
                                    <p className="text-sm text-blue-200">
                                        Lost your local storage? Request a backup of your redeemed codes. You will need to verify your identity on Discord.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Community Name</label>
                                    <input
                                        type="text"
                                        value={communityName || 'Not Set'}
                                        disabled
                                        className="w-full bg-gray-800 border border-gray-700 p-3 text-gray-400 cursor-not-allowed"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Your Discord Handle</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. username#1234 or @username"
                                        value={discordHandle}
                                        onChange={(e) => setDiscordHandle(e.target.value)}
                                        className="w-full bg-gray-950 border border-gray-800 p-3 text-white focus:border-primary outline-none"
                                        autoFocus
                                    />
                                </div>

                                {error && <p className="text-red-400 text-sm">{error}</p>}

                                <Button 
                                    fullWidth 
                                    onClick={handleSubmit} 
                                    disabled={isSubmitting || !discordHandle.trim()}
                                    icon={isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                                >
                                    {isSubmitting ? 'Submitting...' : 'Submit Request'}
                                </Button>
                            </>
                        )) : (
                            <div className="space-y-4">
                                <div className="bg-gray-800/50 border border-gray-700 p-4 flex items-start gap-3">
                                    <Upload className="text-gray-400 shrink-0 mt-0.5" size={18} />
                                    <p className="text-sm text-gray-300">
                                        Upload the CSV file provided by your community admin to restore your redeemed codes to this device.
                                    </p>
                                </div>

                                {importStats ? (
                                    <div className="bg-green-900/20 border border-green-500/30 p-6 text-center space-y-2">
                                        <CheckCircle2 className="text-green-400 mx-auto mb-2" size={32} />
                                        <h3 className="text-lg font-bold text-white">Import Complete</h3>
                                        <p className="text-sm text-gray-300">
                                            Successfully restored <strong className="text-white">{importStats.imported}</strong> codes.
                                        </p>
                                        {importStats.skipped > 0 && (
                                            <p className="text-xs text-gray-500">
                                                Skipped {importStats.skipped} duplicates already on this device.
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="border-2 border-dashed border-gray-700 p-8 text-center hover:border-blue-500/50 hover:bg-blue-900/10 transition-colors relative cursor-pointer">
                                        <input 
                                            type="file" 
                                            accept=".csv" 
                                            onChange={handleFileUpload}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                        <Upload className="text-gray-500 mx-auto mb-3" size={32} />
                                        <p className="text-sm font-bold text-white mb-1">Tap to select CSV file</p>
                                        <p className="text-xs text-gray-500">Must be a valid recovery file</p>
                                    </div>
                                )}

                                {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
