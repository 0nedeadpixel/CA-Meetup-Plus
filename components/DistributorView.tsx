
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
// @ts-ignore
import { doc, writeBatch, collection, onSnapshot, query, where, getDocs, setDoc, updateDoc, serverTimestamp, getDoc, runTransaction, orderBy, limit, increment } from 'firebase/firestore';
// @ts-ignore
import { logEvent } from 'firebase/analytics';
import { db, analytics, auth } from '../firebase';
import { CodeItem, AppSettings, ReportItem, SessionData } from '../types';
import { Button } from './Button';
import { Check, Wifi, ArrowLeft, Loader2, Zap, AlertTriangle, Printer, PauseCircle, PlayCircle, StopCircle, Copy, AlertCircle, RefreshCw, Download, X, Edit2, Save, Link as LinkIcon, Maximize2, XCircle, User } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { ConfirmationModal } from './ConfirmationModal';
import { useToast } from './ToastContext';
import { InfoModal } from './InfoModal';

// Fix for framer-motion type mismatch
const MotionDiv = motion.div as any;

// Hardcoded Test Codes
const TEST_CODE_LIST = [
    "TESTMODE11111", "TESTMODE22222", "TESTMODE33333", "TESTMODE44444", "TESTMODE55555",
    "TESTMODE66666", "TESTMODE77777", "TESTMODE88888", "TESTMODE99999", "TESTMODE12222",
    "TESTMODE13333", "TESTMODE14444", "TESTMODE15555", "TESTMODE16666", "TESTMODE17777",
    "TESTMODE18888", "TESTMODE19999", "TESTMODE10000", "TESTMODE1111A", "TESTMODE2222A",
    "TESTMODE3333A", "TESTMODE4444A", "TESTMODE5555A", "TESTMODE6666A", "TESTMODE7777A",
    "TESTMODE8888A", "TESTMODE9999A", "TESTMODE1222A", "TESTMODE1333A", "TESTMODE1444A",
    "TESTMODE1555A", "TESTMODE1666A", "TESTMODE1777A", "TESTMODE1888A", "TESTMODE1999A",
    "TESTMODE1000A"
];

interface DistributorProps {
  codes: CodeItem[];
  // UPDATED: Now accepts objects with timestamps and IGN
  onSessionComplete: (usedData: {id: string, claimedAt: number, claimedByIgn?: string}[]) => void;
  onExit: () => void;
  settings: AppSettings;
}

export const DistributorView: React.FC<DistributorProps> = ({ codes, onSessionComplete, onExit, settings }) => {
  // If we are "resuming" a session, we need to check local storage for the ID, otherwise generate new
  const [sessionId, setSessionId] = useState<string>(() => {
      const active = localStorage.getItem('pogo_last_active_session');
      return active || uuidv4();
  });

  const [isResuming, setIsResuming] = useState(false);
  const [status, setStatus] = useState<'initializing' | 'active' | 'paused' | 'error' | 'cap_reached' | 'ended'>('initializing');
  const [claimedCount, setClaimedCount] = useState(0);
  // Track Live Cap from DB to allow editing
  const [liveCap, setLiveCap] = useState(settings.distributionCap);
  const [isIssueMode, setIsIssueMode] = useState(false);
  
  const [recentClaim, setRecentClaim] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Reporting State
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [showIssueManager, setShowIssueManager] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Cap Editing State
  const [showEditCap, setShowEditCap] = useState(false);
  const [newCapInput, setNewCapInput] = useState('');

  // Recent Activity State
  const [recentClaimsList, setRecentClaimsList] = useState<any[]>([]);

  // Toast context
  const { addToast } = useToast();

  // UI State
  const [linkCopied, setLinkCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  const [showNfcInfoModal, setShowNfcInfoModal] = useState(false);
  
  // Raffle Linking State
  // Removed automatic linking state

  const getCodesToDistribute = () => {
      if (settings.testMode) {
          return TEST_CODE_LIST.map(val => ({
              id: uuidv4(),
              value: val,
              isUsed: false,
              dateAdded: Date.now()
          } as CodeItem));
      }
      return codes.filter(c => !c.isUsed);
  };

  const [codesToUpload] = useState(getCodesToDistribute());
  // We need to know the total avail in session to show "Remaining".
  const [totalCodesInSession, setTotalCodesInSession] = useState(codesToUpload.length);


  // 1. Initialize OR Resume Session
  useEffect(() => {
    const initSession = async () => {
        const storedSessionId = localStorage.getItem('pogo_last_active_session');

        // CASE A: Resuming an existing active session
        if (storedSessionId && storedSessionId === sessionId) {
            setIsResuming(true);
            const ref = doc(db, 'sessions', storedSessionId);
            const snap = await getDoc(ref);
            
            if (snap.exists()) {
                const data = snap.data() as SessionData;
                if (data.active) {
                    if (data.paused) setStatus('paused');
                    else if (data.distributionCap > 0 && data.claimedCount >= data.distributionCap) setStatus('cap_reached');
                    else setStatus('active');
                    
                    setClaimedCount(data.claimedCount || 0);
                    setLiveCap(data.distributionCap || 0);
                    setTotalCodesInSession(data.totalCodes || 0);
                    return; 
                }
            } 
        }

        // CASE B: Creating New Session
        if (codesToUpload.length === 0) {
            if (!settings.testMode) {
                // Allow UI to render "All Done" instead of crashing
                setStatus('active'); 
                return;
            }
        }

        try {
            // A. Deactivate Previous Session
            if (storedSessionId && storedSessionId !== sessionId) {
                try {
                    const lastSessionRef = doc(db, 'sessions', storedSessionId);
                    updateDoc(lastSessionRef, { active: false }).catch(console.warn);
                } catch (e) { console.warn("Error clearing previous session", e); }
            }

            // B. Create Parent Session Document
            const sessionRef = doc(db, 'sessions', sessionId);
            await setDoc(sessionRef, {
                active: true,
                paused: false,
                createdAt: serverTimestamp(),
                totalCodes: codesToUpload.length,
                hostDevice: auth.currentUser?.uid || localStorage.getItem('pogo_device_id') || 'unknown',
                distributionCap: settings.distributionCap,
                blockIncognito: settings.blockIncognito || false,
                isTestSession: settings.testMode,
                removeDailyLimit: settings.removeDailyLimit || false,
                ambassador: settings.ambassador || { communityName: '', campfireUrl: '', groupLogo: null, notes: '' },
                claimedCount: 0,
                reportCount: 0,
                replacementCount: 0
            });

            localStorage.setItem('pogo_last_active_session', sessionId);

            // C. Upload Codes Batch
            const batchSize = 450;
            for (let i = 0; i < codesToUpload.length; i += batchSize) {
                const chunk = codesToUpload.slice(i, i + batchSize);
                const batch = writeBatch(db);
                
                chunk.forEach(code => {
                    const ref = doc(db, `sessions/${sessionId}/codes/${code.id}`);
                    batch.set(ref, {
                        value: code.value,
                        claimed: false,
                        originalId: code.id
                    });
                });
                await batch.commit();
            }

            if (analytics) {
                logEvent(analytics, 'session_start', {
                    is_test: settings.testMode,
                    code_count: codesToUpload.length,
                    cap: settings.distributionCap,
                    community_name: settings.ambassador.communityName || ''
                });
            }

            setStatus('active');
        } catch (e: any) {
            console.error("Failed to upload codes", e);
            localStorage.removeItem('pogo_last_active_session');
            setErrorMsg(e.message || "Unknown error");
            setStatus('error');
        }
    };

    initSession();
  }, []); 

  // 2. Listen for Claims, Reports & Status Updates
  useEffect(() => {
    if (status === 'initializing' || status === 'error') return;

    // Listen to Session Status
    const sessionUnsub = onSnapshot(doc(db, 'sessions', sessionId), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data() as SessionData;
            // Sync Live Cap from DB
            setLiveCap(data.distributionCap || 0);
            if (data.totalCodes) setTotalCodesInSession(data.totalCodes);
            setIsIssueMode(data.isIssueMode || false);

            if (!data.active) setStatus('ended');
            else if (data.paused) setStatus('paused');
            else if (data.distributionCap > 0 && data.claimedCount >= data.distributionCap) setStatus('cap_reached');
            else setStatus('active');
        }
    });

    // Listen to Claims
    const qClaims = query(collection(db, `sessions/${sessionId}/codes`), where("claimed", "==", true));
    const codesUnsub = onSnapshot(qClaims, (snapshot: any) => {
        const currentCount = snapshot.size;
        setClaimedCount(currentCount);
        
        // Sort by claimedAt desc for Recent Activity List
        const allClaimed = snapshot.docs.map((d:any) => d.data());
        allClaimed.sort((a:any, b:any) => {
            const tA = a.claimedAt?.seconds || 0;
            const tB = b.claimedAt?.seconds || 0;
            return tB - tA;
        });
        setRecentClaimsList(allClaimed.slice(0, 5));

        snapshot.docChanges().forEach((change: any) => {
            if (change.type === "added") {
                if (settings.vibration && navigator.vibrate) navigator.vibrate(100);
                const data = change.doc.data() as any;
                setRecentClaim(data.value);
                setTimeout(() => setRecentClaim(null), 3000);
            }
        });
    });

    // Listen to Reports
    const qReports = query(collection(db, `sessions/${sessionId}/reports`), orderBy("timestamp", "desc"));
    const reportsUnsub = onSnapshot(qReports, (snapshot: any) => {
        const items: ReportItem[] = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        setReports(items);
        // Alert if new pending report
        const hasPending = items.some(r => r.status === 'pending');
        if (hasPending && settings.vibration && navigator.vibrate) navigator.vibrate([200, 100, 200]);
    });

    return () => {
        sessionUnsub();
        codesUnsub();
        reportsUnsub();
    };
  }, [sessionId, settings.vibration, status]);


  // --- ACTIONS ---

  const handleResolveReport = async (report: ReportItem) => {
      setResolvingId(report.id);
      try {
        await runTransaction(db, async (transaction: any) => {
             // Get one unused code
             const codesRef = collection(db, `sessions/${sessionId}/codes`);
             const q = query(codesRef, where("claimed", "==", false), limit(1));
             const codeSnap = await getDocs(q);

             if (codeSnap.empty) throw new Error("NO_CODES_LEFT");
             const freshCodeDoc = codeSnap.docs[0];
             
             // Mark code as claimed
             transaction.update(freshCodeDoc.ref, {
                 claimed: true,
                 claimedBy: report.deviceId,
                 claimedByIgn: report.ign || 'Trainer',
                 claimedAt: serverTimestamp(),
                 isReplacement: true
             });

             // Mark the bad code as bad
             const badCodeQuery = query(codesRef, where("value", "==", report.badCode), limit(1));
             const badCodeSnap = await getDocs(badCodeQuery);
             if (!badCodeSnap.empty) {
                 transaction.update(badCodeSnap.docs[0].ref, {
                     isBadCode: true
                 });
             }

             // Update Report
             const reportRef = doc(db, `sessions/${sessionId}/reports/${report.id}`);
             transaction.update(reportRef, {
                 status: 'resolved',
                 newCode: freshCodeDoc.data().value,
                 resolvedAt: serverTimestamp()
             });

             // Increment session count AND replacement count
             const sessionRef = doc(db, 'sessions', sessionId);
             transaction.update(sessionRef, { 
                 claimedCount: increment(1),
                 replacementCount: increment(1)
             });
        });
        
        addToast("Fresh code sent to Trainer's device!", 'success');

        if (analytics) logEvent(analytics, 'resolve_report', { community_name: settings.ambassador.communityName || '' });

      } catch (e: any) {
          addToast("Failed to send replacement: " + e.message, 'error');
      } finally {
          setResolvingId(null);
      }
  };

  const handleExportReports = () => {
      const csv = "Original Code,New Code,Status,Device ID,Time\n" + 
        reports.map(r => `${r.badCode},${r.newCode || ''},${r.status},${r.deviceId},${new Date(r.timestamp).toLocaleString()}`).join("\n");
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reported_codes_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
  };

  const handleBack = () => { onExit(); };

  const handleEndSessionClick = () => {
      setShowEndSessionModal(true);
  }

  const confirmEndSession = async () => {
        try {
            await updateDoc(doc(db, 'sessions', sessionId), { active: false });
            localStorage.removeItem('pogo_last_active_session');
            setStatus('ended');
            
            // Refund Unused Codes logic
            if (!settings.testMode) {
                // Get claimed IDs AND timestamps from DB for accurate reporting
                const qClaimed = query(collection(db, `sessions/${sessionId}/codes`), where("claimed", "==", true));
                const snapClaimed = await getDocs(qClaimed);
                
                const claimedData = snapClaimed.docs.map((d: any) => {
                    const data = d.data();
                    return {
                        id: data.originalId,
                        // Convert Firestore timestamp to millis
                        claimedAt: data.claimedAt ? (data.claimedAt.seconds * 1000) : Date.now(),
                        claimedByIgn: data.claimedByIgn, // Extract IGN for report
                        isBadCode: data.isBadCode || false
                    };
                });
                
                // Send used IDs to parent (App.tsx), parent will refund the rest and update dates
                onSessionComplete(claimedData);
            }
            if (analytics) logEvent(analytics, 'session_end', { session_id: sessionId });
            onExit();
        } catch (e) { console.error("Error ending session", e); }
  };

  const togglePause = async () => {
      const isPaused = status === 'paused';
      try { await updateDoc(doc(db, 'sessions', sessionId), { paused: !isPaused }); } catch (e) { console.error(e); }
  };

  const handlePrint = () => {
      if (analytics) logEvent(analytics, 'print_qr');
      window.print();
  };

  const handleProgramNFC = async () => {
      if (!('NDEFReader' in window)) {
          setShowNfcInfoModal(true);
          return;
      }
      try {
          // @ts-ignore
          const ndef = new NDEFReader();
          await ndef.write({
              records: [{ recordType: "url", data: constructUrl() }]
          });
          addToast("Success! NFC Tag Written. Tap this tag to open the redeem page.", 'success');
          if (analytics) logEvent(analytics, 'nfc_program');
      } catch (error) {
          addToast("NFC Write Failed. Make sure the tag is writable and near the back of your phone.", 'error');
          console.error(error);
      }
  };

  const handleUpdateCap = async () => {
      const val = parseInt(newCapInput);
      if (isNaN(val) || val < 0) {
          addToast("Please enter a valid number", 'warning');
          return;
      }
      try {
          await updateDoc(doc(db, 'sessions', sessionId), { distributionCap: val });
          setShowEditCap(false);
      } catch (e) {
          addToast("Failed to update cap", 'error');
      }
  };

  const constructUrl = () => {
    let baseUrl = window.location.origin + window.location.pathname;
    if (baseUrl.endsWith('/')) { baseUrl = baseUrl.slice(0, -1); }
    return `${baseUrl}/#/session/${sessionId}`;
  };

  const handleCopyLink = () => {
      const url = constructUrl();
      navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
  };
  
  const pendingReportsCount = reports.filter(r => r.status === 'pending').length;

  if (codesToUpload.length === 0 && status !== 'initializing' && !isResuming && status !== 'active' && status !== 'paused' && status !== 'cap_reached') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-6">
        <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <Check className="w-12 h-12 text-primary" />
        </div>
        <h2 className="text-3xl font-bold text-white">All Done!</h2>
        <p className="text-gray-400">You have no unused codes to distribute.</p>
        <Button onClick={onExit} variant="secondary">Back to Dashboard</Button>
      </div>
    );
  }

  if (status === 'initializing') {
      return (
        <div className="flex flex-col items-center justify-center h-full bg-gray-950 gap-4">
            <Loader2 className="animate-spin text-primary" size={48} />
            <h2 className="text-white font-bold text-xl">{isResuming ? 'Resuming Session...' : 'Creating Session...'}</h2>
            <p className="text-gray-400 text-sm">Syncing with the cloud.</p>
        </div>
      )
  }

  if (status === 'error') {
      return (
        <div className="flex flex-col items-center justify-center h-full bg-gray-950 gap-4 p-6 text-center">
             <h2 className="text-white font-bold text-xl">Connection Failed</h2>
             <p className="text-xs text-red-400 font-mono bg-gray-900 p-2">{errorMsg}</p>
             <div className="flex flex-col gap-2 w-full">
                <Button onClick={() => window.location.reload()} variant="primary">Retry</Button>
                <Button onClick={() => { localStorage.removeItem('pogo_last_active_session'); onExit(); }} variant="secondary">Cancel & Clear</Button>
             </div>
        </div>
      )
  }

  return (
    <div className="flex flex-col h-full bg-gray-950 print:bg-white print:h-auto overflow-y-auto">
      <ConfirmationModal 
        isOpen={showEndSessionModal}
        onClose={() => setShowEndSessionModal(false)}
        onConfirm={confirmEndSession}
        title="End Session?"
        message="Are you sure? This will invalidate the QR code and stop distribution."
        confirmText="Yes, End Session"
        isDanger={true}
      />

      {/* Top Bar - Standardized Sticky Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900 sticky top-0 z-30 print:hidden shrink-0">
        <div className="flex items-center gap-4">
            <button onClick={handleBack} className="p-2 bg-gray-800 rounded-full border border-gray-700 text-gray-400 hover:text-white">
            <ArrowLeft size={20} />
            </button>
            <div>
                <h1 className="text-xl font-bold text-white">Code Distributor</h1>
                <div className="flex items-center gap-2 text-xs font-mono">
                    <span className={`w-2 h-2 rounded-full ${status === 'active' ? 'bg-primary animate-pulse' : status === 'paused' ? 'bg-yellow-500' : 'bg-red-500'}`}></span>
                    <span className="text-gray-500 font-bold uppercase tracking-wider">
                        {status === 'cap_reached' ? 'CAP REACHED' : status === 'paused' ? 'PAUSED' : 'LIVE'}
                    </span>
                    {settings.testMode && <span className="bg-yellow-500/20 text-yellow-500 px-1.5 text-[10px] font-bold">TEST</span>}
                </div>
            </div>
        </div>
        <div className="flex gap-2">
             <Button variant="danger" onClick={handleEndSessionClick} className="h-9 text-xs px-3">End</Button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col items-center justify-start w-full max-w-md mx-auto px-4 pb-12 gap-6 print:pb-0 print:pt-10 pt-6">
        
        {/* QR Card - Uniform Design */}
        <div className={`relative w-full bg-white p-4  shadow-2xl flex flex-col items-center justify-center text-center transition-opacity print:shadow-none print:max-w-[500px]
            ${status === 'cap_reached' ? 'opacity-50 grayscale' : ''}`}>
            
            {/* FLOATING ISSUE INDICATOR */}
            <button
                onClick={async () => {
                    if (pendingReportsCount > 0) {
                        setShowIssueManager(true);
                    } else {
                        const newMode = !isIssueMode;
                        setIsIssueMode(newMode);
                        await updateDoc(doc(db, 'sessions', sessionId), { isIssueMode: newMode });
                    }
                }}
                className={`absolute top-4 left-4 p-2 rounded-full transition-all duration-300 z-40 print:hidden shadow-lg ${
                    pendingReportsCount > 0 
                        ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                        : isIssueMode 
                            ? 'bg-green-400 text-white shadow-[0_0_15px_rgba(74,222,128,0.6)] animate-pulse' 
                            : 'bg-gray-100 text-gray-400 hover:text-gray-600'
                }`}
                title={pendingReportsCount > 0 ? "View Reports" : "Toggle Issue Mode"}
            >
                <div className="relative">
                    <AlertCircle size={24} className={pendingReportsCount > 0 ? "animate-pulse" : ""} />
                    {pendingReportsCount > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full font-bold border-2 border-white shadow-sm">
                            {pendingReportsCount}
                        </span>
                    )}
                </div>
            </button>

            <QRCodeSVG value={constructUrl()} size={250} level="M" includeMargin={true} />
            
            <h3 className="hidden print:block text-black font-bold text-2xl">Scan to Claim Code</h3>
            <h3 className="print:hidden text-black font-bold text-2xl">Scan to Claim</h3>

            <div className="flex gap-2 print:hidden mt-4">
                <button 
                    onClick={() => setShowQrModal(true)} 
                    className="px-4 py-2 bg-gray-100 rounded-full text-xs font-bold text-gray-700 flex items-center gap-2 hover:bg-gray-200 transition-colors"
                >
                    <Maximize2 size={14}/> Fullscreen
                </button>
                <button 
                    onClick={handleCopyLink} 
                    className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-colors ${linkCopied ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}
                >
                    {linkCopied ? <Check size={14} /> : <LinkIcon size={14}/>} 
                    {linkCopied ? 'Link Copied!' : 'Copy Link'}
                </button>
            </div>

            {status === 'cap_reached' && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 print:hidden z-20">
                     <span className="text-red-500 font-bold text-xl rotate-[-12deg] border-2 border-red-500 px-4 py-2">SESSION ENDED</span>
                </div>
            )}
            {status === 'paused' && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 print:hidden z-20">
                     <span className="text-yellow-500 font-bold text-xl border-2 border-yellow-500 px-4 py-2 flex gap-2 items-center">
                        <PauseCircle /> PAUSED
                     </span>
                </div>
            )}
        </div>

        {/* Live Feed / Stats (Hidden on Print) */}
        <div className="w-full bg-gray-900 p-6 border border-gray-800 flex flex-col gap-4 print:hidden">
            <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                <div className="text-center flex-1 border-r border-gray-800">
                    <div className="text-3xl font-bold text-white">{isResuming ? (totalCodesInSession - claimedCount) : (codesToUpload.length - claimedCount)}</div>
                    <div className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Remaining</div>
                </div>
                <div className="text-center flex-1">
                    <div className="flex items-center justify-center gap-2">
                        <div className="text-3xl font-bold text-primary">
                            {claimedCount} 
                            {liveCap > 0 && <span className="text-gray-500 text-lg"> / {liveCap}</span>}
                        </div>
                        <button 
                            onClick={() => { setNewCapInput(liveCap.toString()); setShowEditCap(true); }}
                            className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white"
                        >
                            <Edit2 size={14} />
                        </button>
                    </div>
                    <div className="text-center text-[10px] uppercase text-gray-500 font-bold tracking-wider">Claimed</div>
                </div>
            </div>

            {/* Controls */}
            <div className="grid grid-cols-2 gap-3">
                 <Button variant="secondary" onClick={togglePause} className="h-12 text-sm">
                     {status === 'paused' ? <><PlayCircle size={18} className="text-green-400"/> Resume</> : <><PauseCircle size={18} className="text-yellow-400"/> Pause</>}
                 </Button>
                 
                 <div className="flex gap-2">
                    <Button variant="secondary" onClick={handlePrint} className="h-12 text-sm flex-1">
                        <Printer size={18} /> Print
                    </Button>
                    
                    {/* UPDATED NFC BUTTON: Now uses text instead of SVG */}
                    <Button variant="secondary" onClick={handleProgramNFC} className="h-12 w-12 flex items-center justify-center p-0 font-bold text-xs">
                        NFC
                    </Button>
                 </div>
            </div>

            {/* END SESSION BUTTON (Moved from floating pill) */}
            <Button 
                variant="danger" 
                onClick={handleEndSessionClick}
                className="h-12 text-sm w-full"
                icon={<StopCircle size={18} />}
            >
                End Session
            </Button>

            {/* Cap Warning */}
            {liveCap > 0 && claimedCount >= liveCap && (
                 <div className="bg-red-500/10 text-red-500 text-xs font-bold px-3 py-2 flex items-center justify-center gap-2">
                    <AlertTriangle size={14} /> DISTRIBUTION CAP REACHED
                 </div>
            )}

            {/* Recent Activity Toast */}
            <div className="h-10 flex items-center justify-center">
                <AnimatePresence mode="wait">
                    {recentClaim ? (
                        <MotionDiv key={recentClaim} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex items-center gap-2 text-primary font-mono text-sm">
                            <Zap size={14} fill="currentColor" /> {recentClaim} claimed!
                        </MotionDiv>
                    ) : (
                        <span className="text-gray-600 text-xs italic">Waiting for scans...</span>
                    )}
                </AnimatePresence>
            </div>
        </div>

        {/* Recent Activity List */}
        {recentClaimsList.length > 0 && (
            <div className="w-full bg-gray-900 p-4 border border-gray-800 print:hidden">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Recent Claims</h3>
                <div className="space-y-2">
                    {recentClaimsList.map((claim, idx) => {
                        const report = reports.find(r => r.badCode === claim.value);
                        const isReported = !!report;
                        const isResolved = report?.status === 'resolved';
                        return (
                        <div key={idx} className={`flex justify-between items-center text-sm p-2  ${isReported ? 'bg-red-900/20 border border-red-500/30' : 'bg-gray-950'}`}>
                            <div className="flex items-center gap-2">
                                <User size={14} className={isReported ? "text-red-400" : "text-gray-600"}/>
                                <span className={isReported ? "text-red-300 font-bold" : "text-gray-300 font-bold"}>{claim.claimedByIgn || 'Trainer'}</span>
                                {isReported && (
                                    <span className={`text-[10px] text-white px-1  font-bold uppercase ${isResolved ? 'bg-red-600' : 'bg-orange-500'}`}>
                                        {isResolved ? 'Bad Code' : 'Reported'}
                                    </span>
                                )}
                            </div>
                            <div className="text-right">
                                <div className={`font-mono text-xs ${isReported ? 'text-red-400 line-through opacity-70' : 'text-primary'}`}>{claim.value}</div>
                                <div className="text-[10px] text-gray-600">{claim.claimedAt ? new Date(claim.claimedAt.seconds * 1000).toLocaleTimeString() : 'Just now'}</div>
                            </div>
                        </div>
                    )})}
                </div>
            </div>
        )}
      </div>

      {/* EDIT CAP MODAL */}
      <AnimatePresence>
          {showEditCap && (
              <MotionDiv 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
              >
                  <div className="bg-gray-900 border border-gray-700 p-6 w-full max-w-sm">
                      <h3 className="text-xl font-bold text-white mb-4">Edit Session Cap</h3>
                      <input 
                          type="number" 
                          value={newCapInput}
                          onChange={(e) => setNewCapInput(e.target.value)}
                          className="w-full bg-gray-950 border border-gray-800 p-4 text-2xl font-bold text-center text-white mb-4 focus:border-primary outline-none"
                          placeholder="0 = Unlimited"
                      />
                      <div className="flex gap-2">
                          <Button variant="secondary" onClick={() => setShowEditCap(false)} fullWidth>Cancel</Button>
                          <Button variant="primary" onClick={handleUpdateCap} fullWidth icon={<Save size={18}/>}>Save</Button>
                      </div>
                  </div>
              </MotionDiv>
          )}
      </AnimatePresence>

      {/* ISSUE MANAGER MODAL */}
      <AnimatePresence>
          {showIssueManager && (
              <MotionDiv 
                initial={{ opacity: 0, y: '100%' }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: '100%' }}
                className="fixed inset-0 z-50 bg-gray-950 flex flex-col pt-10 px-4 pb-4"
              >
                  <div className="flex justify-between items-center mb-6">
                      <h2 className="text-2xl font-bold text-white flex items-center gap-2"><AlertCircle className="text-red-500"/> Issue Manager</h2>
                      <button onClick={() => setShowIssueManager(false)} className="p-2 bg-gray-800 rounded-full"><X size={20} className="text-white"/></button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                      {reports.length === 0 ? (
                          <div className="text-center text-gray-500 mt-20">No reports filed yet. Good job!</div>
                      ) : (
                          reports.map(report => (
                              <div key={report.id} className={`p-4  border ${report.status === 'resolved' || report.status === 'cancelled' ? 'bg-gray-900 border-gray-800 opacity-50' : 'bg-gray-900 border-red-500/50'}`}>
                                  <div className="flex justify-between items-start mb-2">
                                      <div>
                                          <div className="font-mono font-bold text-white">{report.badCode}</div>
                                          <div className="text-xs text-gray-400">{new Date(report.timestamp).toLocaleTimeString()}</div>
                                      </div>
                                      <div className={`px-2 py-1  text-[10px] font-bold uppercase ${report.status === 'resolved' ? 'bg-green-500/20 text-green-500' : report.status === 'cancelled' ? 'bg-gray-700 text-gray-400' : 'bg-red-500/20 text-red-500'}`}>
                                          {report.status}
                                      </div>
                                  </div>
                                  
                                  {report.status === 'resolved' ? (
                                      <div className="text-xs text-green-400 mt-2 flex items-center gap-1">
                                          <Check size={12}/> Replaced with: {report.newCode}
                                      </div>
                                  ) : report.status === 'cancelled' ? (
                                      <div className="text-xs text-gray-500 mt-2 flex items-center gap-1 italic">
                                          <XCircle size={12}/> Request Cancelled by User
                                      </div>
                                  ) : (
                                      <Button 
                                        variant="secondary" 
                                        className="h-10 text-xs mt-3 w-full border-red-500/30 text-red-400 hover:bg-red-500/10"
                                        onClick={() => handleResolveReport(report)}
                                        disabled={resolvingId === report.id}
                                      >
                                          {resolvingId === report.id ? <Loader2 className="animate-spin"/> : <><RefreshCw size={14}/> Send Fresh Code</>}
                                      </Button>
                                  )}
                              </div>
                          ))
                      )}
                  </div>
                  
                  {reports.length > 0 && (
                      <Button variant="secondary" onClick={handleExportReports} icon={<Download size={18}/>}>
                          Export Bad Codes (CSV)
                      </Button>
                  )}
              </MotionDiv>
          )}
      </AnimatePresence>

      {/* QR MODAL */}
      <AnimatePresence>
          {showQrModal && (
              <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6" onClick={() => setShowQrModal(false)}>
                  <button onClick={() => setShowQrModal(false)} className="absolute top-6 right-6 p-2 bg-gray-800 rounded-full text-white"><X size={32} /></button>
                  <div className="bg-white p-6" onClick={e => e.stopPropagation()}><QRCodeSVG value={constructUrl()} size={window.innerWidth > 400 ? 350 : 250} /></div>
                  <h2 className="text-white text-2xl font-bold mt-8">Scan to Claim</h2>
                  <div className="mt-8"><button onClick={handleCopyLink} className={`px-6 py-3 rounded-full text-sm font-bold flex items-center gap-2 transition-colors ${linkCopied ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{linkCopied ? <Check size={16} /> : <LinkIcon size={16}/>} {linkCopied ? 'Link Copied!' : 'Copy Link'}</button></div>
              </MotionDiv>
          )}
      </AnimatePresence>

      <InfoModal 
        isOpen={showNfcInfoModal}
        onClose={() => setShowNfcInfoModal(false)}
        title="NFC Writing Unavailable"
        message={`NFC writing currently requires Chrome on Android.\n\nHowever, the link is valid! You can use an external NFC tools app to write this URL to your tag:\n\n${constructUrl()}`}
        type="info"
      />
    </div>
  );
};
