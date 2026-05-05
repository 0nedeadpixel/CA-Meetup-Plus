import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Button } from './Button';
import { CheckCircle2, Download, AlertTriangle, Loader2, Search } from 'lucide-react';

interface RecoveryRequest {
    id: string;
    communityName: string;
    discordHandle: string;
    status: 'pending' | 'resolved';
    createdAt: any;
}

export const RecoveryRequestsManager: React.FC = () => {
    const [requests, setRequests] = useState<RecoveryRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [communities, setCommunities] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isDownloadingManual, setIsDownloadingManual] = useState(false);

    useEffect(() => {
        // Fetch all unique communities
        const fetchCommunities = async () => {
            try {
                const snap = await getDocs(collection(db, 'sessions'));
                const comms = new Set<string>();
                snap.forEach(doc => {
                    const data = doc.data();
                    if (data.ambassador?.communityName) {
                        comms.add(data.ambassador.communityName.trim());
                    }
                });
                setCommunities(Array.from(comms).sort());
            } catch (e) {
                console.error("Failed to fetch communities:", e);
            }
        };
        fetchCommunities();

        const q = query(collection(db, 'recovery_requests'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            const reqs: RecoveryRequest[] = [];
            snap.forEach(doc => {
                reqs.push({ id: doc.id, ...doc.data() } as RecoveryRequest);
            });
            setRequests(reqs);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleDownloadCSV = async (communityName: string, requestId?: string) => {
        if (requestId) setDownloadingId(requestId);
        else setIsDownloadingManual(true);

        try {
            // 1. Find all sessions for this community
            const sessionsQuery = query(
                collection(db, 'sessions'),
                where('ambassador.communityName', 'in', [communityName, communityName + ' '])
            );
            const sessionsSnap = await getDocs(sessionsQuery);
            
            const allCodes: any[] = [];
            
            // 2. Fetch all codes for these sessions
            for (const sessionDoc of sessionsSnap.docs) {
                const codesQuery = query(
                    collection(db, `sessions/${sessionDoc.id}/codes`),
                    where('claimed', '==', true)
                );
                const codesSnap = await getDocs(codesQuery);
                
                codesSnap.forEach(codeDoc => {
                    const data = codeDoc.data();
                    allCodes.push({
                        code: data.value,
                        ign: data.claimedByIgn || 'Unknown',
                        date: data.claimedAt ? data.claimedAt.toDate().toISOString() : 'Unknown',
                        source: data.source || 'direct_scan'
                    });
                });
            }

            // 3. Generate CSV
            if (allCodes.length === 0) {
                alert('No redeemed codes found for this community.');
                setDownloadingId(null);
                return;
            }

            let csvContent = "Code,IGN,Date,Source\n";
            allCodes.forEach(c => {
                csvContent += `${c.code},${c.ign},"${c.date}",${c.source}\n`;
            });

            // 4. Download file
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `${communityName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_recovery.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (e) {
            console.error("Error generating CSV:", e);
            alert("Failed to generate CSV.");
        } finally {
            if (requestId) setDownloadingId(null);
            else setIsDownloadingManual(false);
        }
    };

    const handleMarkResolved = async (id: string) => {
        try {
            await updateDoc(doc(db, 'recovery_requests', id), {
                status: 'resolved'
            });
        } catch (e) {
            console.error("Failed to resolve request:", e);
        }
    };

    const filteredCommunities = communities.filter(c => 
        c.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
         .includes(searchQuery.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Manual Download Section */}
            <div className="bg-gray-900 border border-gray-800 p-4">
                <h3 className="font-bold text-white mb-3">Manual Report Download</h3>
                <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input 
                        type="text" 
                        placeholder="Search community name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 pl-10 pr-4 py-2 text-sm text-white focus:border-primary outline-none"
                    />
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                    {filteredCommunities.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-2">No communities found.</p>
                    ) : (
                        filteredCommunities.map(comm => (
                            <div key={comm} className="flex items-center justify-between bg-gray-950 p-2 border border-gray-800">
                                <span className="text-sm text-gray-300 truncate pr-2">{comm}</span>
                                <Button 
                                    variant="secondary" 
                                    className="text-[10px] h-7 px-2 shrink-0"
                                    onClick={() => handleDownloadCSV(comm)}
                                    disabled={isDownloadingManual}
                                >
                                    Download
                                </Button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="h-px bg-gray-800 w-full"></div>

            {/* Requests Section */}
            <div>
                <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                    User Requests
                    {requests.filter(r => r.status === 'pending').length > 0 && (
                        <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                            {requests.filter(r => r.status === 'pending').length} Pending
                        </span>
                    )}
                </h3>
                
                {loading ? (
                    <div className="text-center text-gray-500 py-10 animate-pulse">Loading requests...</div>
                ) : requests.length === 0 ? (
                    <div className="text-center text-gray-500 py-10 flex flex-col items-center gap-2">
                        <CheckCircle2 size={32} className="text-gray-700" />
                        <p>No recovery requests.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {requests.map(req => (
                            <div key={req.id} className={`p-4  border ${req.status === 'pending' ? 'bg-red-900/10 border-red-900/30' : 'bg-gray-900 border-gray-800'} flex flex-col gap-3`}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-white flex items-center gap-2">
                                            {req.communityName}
                                            {req.status === 'pending' && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">Pending</span>}
                                        </h3>
                                        <p className="text-sm text-gray-400 mt-1">
                                            Discord: <strong className="text-blue-400">{req.discordHandle}</strong>
                                        </p>
                                        <p className="text-xs text-gray-600 mt-1">
                                            Requested: {req.createdAt?.toDate().toLocaleString() || 'Just now'}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="flex gap-2 mt-2">
                                    <Button 
                                        variant="secondary" 
                                        className="flex-1 text-xs h-10" 
                                        onClick={() => handleDownloadCSV(req.communityName, req.id)}
                                        disabled={downloadingId === req.id}
                                        icon={downloadingId === req.id ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                                    >
                                        {downloadingId === req.id ? 'Generating...' : 'Download CSV'}
                                    </Button>
                                    
                                    {req.status === 'pending' && (
                                        <Button 
                                            variant="primary" 
                                            className="flex-1 text-xs h-10" 
                                            onClick={() => handleMarkResolved(req.id)}
                                            icon={<CheckCircle2 size={14} />}
                                        >
                                            Mark Resolved
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
