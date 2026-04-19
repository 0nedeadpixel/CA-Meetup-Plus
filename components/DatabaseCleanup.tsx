import React, { useState } from 'react';
import { collection, getDocs, doc, deleteDoc, writeBatch, query, collectionGroup, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { Button } from './Button';
import { Trash2, Search, Loader2, AlertTriangle } from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';
import { useToast } from './ToastContext';

interface SuspiciousCode {
    id: string;
    path: string;
    value: string;
    reason: string;
    claimedByIgn?: string;
    isClaimed: boolean;
}

export const DatabaseCleanup: React.FC = () => {
    const [suspiciousCodes, setSuspiciousCodes] = useState<SuspiciousCode[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [filterClaimedOnly, setFilterClaimedOnly] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const { addToast } = useToast();

    const scanDatabase = async () => {
        setIsScanning(true);
        setSuspiciousCodes([]);
        try {
            const codesQuery = collectionGroup(db, 'codes');
            const snap = await getDocs(codesQuery);
            
            const found: SuspiciousCode[] = [];
            
            snap.forEach(docSnap => {
                const data = docSnap.data();
                const value = data.value || '';
                const upperValue = value.toUpperCase();
                
                let reason = '';
                
                if (value.length !== 13) {
                    reason = `Length is ${value.length} (not 13)`;
                } else if (upperValue.includes('TEST')) {
                    reason = 'Contains "TEST"';
                } else if (/(.)\1{4,}/.test(value)) {
                    reason = 'Repeated characters';
                }
                
                if (reason) {
                    const isClaimed = !!data.claimed;
                    if (!filterClaimedOnly || isClaimed) {
                        found.push({
                            id: docSnap.id,
                            path: docSnap.ref.path,
                            value: value,
                            reason: reason,
                            claimedByIgn: data.claimedByIgn,
                            isClaimed: isClaimed
                        });
                    }
                }
            });
            
            setSuspiciousCodes(found);
            if (found.length === 0) {
                addToast("No suspicious codes found!", "success");
            }
        } catch (e) {
            console.error("Error scanning database:", e);
            addToast("Failed to scan database.", "error");
        } finally {
            setIsScanning(false);
        }
    };

    const handleDeleteAll = async () => {
        setIsDeleting(true);
        setShowConfirm(false);
        try {
            // Keep track of how many claimed codes we delete per session
            const sessionClaimedDecrements: Record<string, number> = {};
            
            // 1. Delete all the codes in batches
            const batches = [];
            let currentBatch = writeBatch(db);
            let opCount = 0;
            
            for (const code of suspiciousCodes) {
                const docRef = doc(db, code.path);
                currentBatch.delete(docRef);
                opCount++;
                
                if (code.isClaimed) {
                    // Extract session ID from path: sessions/{sessionId}/codes/{codeId}
                    const parts = code.path.split('/');
                    if (parts.length >= 3 && parts[0] === 'sessions') {
                        const sessionId = parts[1];
                        sessionClaimedDecrements[sessionId] = (sessionClaimedDecrements[sessionId] || 0) + 1;
                    }
                }
                
                if (opCount === 500) {
                    batches.push(currentBatch.commit());
                    currentBatch = writeBatch(db);
                    opCount = 0;
                }
            }
            
            if (opCount > 0) {
                batches.push(currentBatch.commit());
            }
            
            await Promise.all(batches);
            
            // 2. Update the session counts individually so a missing session doesn't fail the batch
            const sessionUpdatePromises = Object.entries(sessionClaimedDecrements).map(async ([sessionId, count]) => {
                try {
                    const sessionRef = doc(db, 'sessions', sessionId);
                    // We use set with merge: true to avoid "No document to update" errors 
                    // if the parent session was already deleted but orphaned codes remained.
                    await writeBatch(db).update(sessionRef, { claimedCount: increment(-count) }).commit();
                } catch (err) {
                    console.warn(`Could not update session ${sessionId} (it may have been deleted already).`);
                }
            });
            
            await Promise.all(sessionUpdatePromises);
            
            addToast(`Successfully deleted ${suspiciousCodes.length} codes.`, "success");
            setSuspiciousCodes([]);
        } catch (e) {
            console.error("Error deleting codes:", e);
            addToast("Failed to delete codes. See console for details.", "error");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="bg-gray-900 border border-gray-800 p-4 mt-4">
            <ConfirmationModal 
                isOpen={showConfirm}
                onClose={() => setShowConfirm(false)}
                onConfirm={handleDeleteAll}
                title="Delete Suspicious Codes"
                message={`Are you sure you want to permanently delete ${suspiciousCodes.length} codes? This action cannot be undone.`}
                confirmText="Delete All"
                isDanger={true}
            />
            
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <AlertTriangle size={18} className="text-yellow-500" />
                        Database Cleanup
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                        Find and remove test codes (length ≠ 13, contains "TEST", or repeated characters).
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={filterClaimedOnly} 
                            onChange={(e) => setFilterClaimedOnly(e.target.checked)}
                            className="border-gray-700 bg-gray-800 text-primary focus:ring-primary"
                        />
                        Redeemed Only
                    </label>
                    <Button 
                        variant="secondary" 
                        onClick={scanDatabase} 
                        disabled={isScanning || isDeleting}
                        icon={isScanning ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                    >
                        {isScanning ? 'Scanning...' : 'Scan Database'}
                    </Button>
                </div>
            </div>

            {suspiciousCodes.length > 0 && (
                <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-red-400">{suspiciousCodes.length} suspicious codes found</span>
                        <Button 
                            variant="danger" 
                            className="h-8 text-xs"
                            onClick={() => setShowConfirm(true)}
                            disabled={isDeleting}
                            icon={isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        >
                            {isDeleting ? 'Deleting...' : 'Delete All'}
                        </Button>
                    </div>
                    
                    <div className="max-h-60 overflow-y-auto border border-gray-800 bg-gray-950 custom-scrollbar">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-900 sticky top-0">
                                <tr>
                                    <th className="p-2 text-gray-400 font-medium">Code</th>
                                    <th className="p-2 text-gray-400 font-medium">Reason</th>
                                    <th className="p-2 text-gray-400 font-medium">Status</th>
                                    <th className="p-2 text-gray-400 font-medium">Claimed By</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {suspiciousCodes.map(code => (
                                    <tr key={code.path} className="hover:bg-gray-900/50">
                                        <td className="p-2 font-mono text-xs text-gray-300">{code.value}</td>
                                        <td className="p-2 text-xs text-yellow-500">{code.reason}</td>
                                        <td className="p-2 text-xs">
                                            {code.isClaimed ? (
                                                <span className="text-green-400">Redeemed</span>
                                            ) : (
                                                <span className="text-gray-500">Unused</span>
                                            )}
                                        </td>
                                        <td className="p-2 text-xs text-gray-500">{code.claimedByIgn || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
