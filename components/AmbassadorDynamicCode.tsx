import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Loader2, Ticket, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export const AmbassadorDynamicCode: React.FC = () => {
    const { hostId } = useParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'no_active'>('loading');
    const [ambassadorInfo, setAmbassadorInfo] = useState<any>(null);

    useEffect(() => {
        const checkSessions = async () => {
            if (!hostId) return;
            try {
                // Fetch ONLY by hostDevice to avoid ANY composite index requirements
                const recentQuery = query(
                    collection(db, 'sessions'),
                    where('hostDevice', '==', hostId)
                );
                
                const recentSnap = await getDocs(recentQuery);
                
                if (!recentSnap.empty) {
                    const docs = recentSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
                    
                    // Manually find active session here to bypass building Firebase composites
                    const activeSession = docs.find(d => d.active === true);
                    
                    if (activeSession) {
                        navigate(`/session/${activeSession.id}`);
                        return;
                    }
                    
                    // If no active session, sort locally by date to find newest for profile info
                    docs.sort((a, b) => {
                        const aTime = a.createdAt?.seconds || 0;
                        const bTime = b.createdAt?.seconds || 0;
                        return bTime - aTime;
                    });
                    
                    const newestSession = docs[0];
                    if (newestSession.ambassador) {
                        setAmbassadorInfo(newestSession.ambassador);
                    }
                }
                
                setStatus('no_active');
            } catch (err) {
                console.error("Error fetching dynamic link", err);
                setStatus('no_active');
            }
        };
        
        checkSessions();
    }, [hostId, navigate]);

    if (status === 'loading') {
        return (
            <div className="flex flex-col h-[100dvh] bg-gray-950 items-center justify-center text-white p-6 text-center">
                <Loader2 className="animate-spin text-primary mb-4" size={48} />
                <h2 className="text-xl font-bold uppercase tracking-widest text-primary mb-2">Connecting</h2>
                <p className="text-gray-400 font-mono text-sm leading-relaxed">Checking for active events...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[100dvh] bg-gray-950 text-white font-sans relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-black pointer-events-none" />
          
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative z-10 w-full max-w-sm mx-auto">
            <div className="relative w-full bg-gray-900 border border-gray-800 shadow-2xl p-6 py-10 md:p-10 flex flex-col items-center">
                <div className="w-24 h-24 rounded-full border-[3px] border-gray-800 shadow-2xl mb-6 flex items-center justify-center bg-black overflow-hidden relative group">
                    {ambassadorInfo?.groupLogo ? (
                        <img src={ambassadorInfo.groupLogo} className="w-full h-full object-cover" alt="Community Logo" />
                    ) : (
                        <Ticket className="text-gray-700" size={40} />
                    )}
                </div>
                
                <h2 className="text-2xl font-black uppercase italic mb-2 tracking-tight text-white/90">No Event Active</h2>
                <p className="text-gray-400 text-sm mb-8 leading-relaxed max-w-[260px]">
                    {ambassadorInfo?.communityName ? 
                        `${ambassadorInfo.communityName} does not have an active promo code drop at this moment.` : 
                        "This Ambassador doesn't have an active event right now."}
                </p>

                <div className="flex flex-col gap-3 w-full">
                    {ambassadorInfo?.campfireUrl && (
                        <Button 
                            variant="secondary"
                            fullWidth 
                            onClick={() => window.open(ambassadorInfo.campfireUrl, '_blank')}
                            className="bg-gray-800/50 hover:bg-gray-800 h-14"
                            icon={<ExternalLink size={18} />}
                        >
                            <span className="font-semibold tracking-wide">Community Hub</span>
                        </Button>
                    )}
                    
                    <Button 
                        variant="primary"
                        fullWidth 
                        onClick={() => window.location.reload()}
                        className="h-14 font-bold tracking-widest shadow-lg shadow-primary/20"
                        icon={<RefreshCw size={18} />}
                    >
                        Try Again
                    </Button>
                </div>
            </div>
          </div>
        </div>
    );
};
