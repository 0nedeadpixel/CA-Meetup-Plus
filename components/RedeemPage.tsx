
import React, { useEffect, useState } from 'react';
// @ts-ignore
import { doc, setDoc, getDoc, serverTimestamp, increment, collection, query, where, limit, getDocs, runTransaction, addDoc, onSnapshot, updateDoc, orderBy } from 'firebase/firestore';
// @ts-ignore
import { logEvent } from 'firebase/analytics';
import { db, analytics } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Copy, ExternalLink, QrCode, X, Ban, AlertCircle, PauseCircle, Flag, CheckCircle, AlertTriangle, Clock, Info, RefreshCw, XCircle, ArrowRight, ChevronLeft, Quote, Ticket, Sparkles, User, Gamepad2, Trophy } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from './Button';
import { v4 as uuidv4 } from 'uuid';
// @ts-ignore
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { AmbassadorSettings, SessionData } from '../types';
import { PrivacyModal } from './PrivacyModal';
import confetti from 'canvas-confetti';
import { useToast } from './ToastContext';

const MotionDiv = motion.div as any;

import { Footer } from './Footer';

export const RedeemPage: React.FC = () => {
  const { sessionId, codeId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  
  const queryParams = new URLSearchParams(location.search);
  const isRaffleWin = queryParams.get('raffleWin') === '1';
  const urlIgn = queryParams.get('ign') || '';

  const [status, setStatus] = useState<'claiming' | 'success' | 'error' | 'limit_reached' | 'empty' | 'session_expired' | 'paused' | 'waiting_fix'>('claiming');
  const [showTransferQR, setShowTransferQR] = useState(false);
  const [redeemedCode, setRedeemedCode] = useState<string>('');
  const [showReportConfirm, setShowReportConfirm] = useState(false);
  const [showIssueModeConfirm, setShowIssueModeConfirm] = useState(false);
  const [showCooldownWarning, setShowCooldownWarning] = useState(false); 
  const [isReporting, setIsReporting] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [oldCode, setOldCode] = useState<string | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(true);
  const [ambassadorInfo, setAmbassadorInfo] = useState<AmbassadorSettings | null>(null);
  const [activeSlide, setActiveSlide] = useState<'WELCOME' | 'CODE'>('CODE');
  const [inputIgn, setInputIgn] = useState(urlIgn || localStorage.getItem('pogo_saved_ign') || '');
  const [lastClaimDate, setLastClaimDate] = useState<string | null>(null);
  
  // Mandatory IGN State
  const [showNameModal, setShowNameModal] = useState(false);
  const [tempName, setTempName] = useState('');
  const [tempNickname, setTempNickname] = useState('');

  useEffect(() => {
    if (urlIgn) {
        localStorage.setItem('pogo_saved_ign', urlIgn);
        setInputIgn(urlIgn);
    }
    const lastTs = localStorage.getItem('pogo_last_claim_ts');
    if (lastTs) {
        const date = new Date(parseInt(lastTs));
        setLastClaimDate(date.toLocaleDateString() + " " + date.toLocaleTimeString());
    }
  }, [urlIgn]);

  // Confetti effect on success
  useEffect(() => {
      if (status === 'success') {
          confetti({
              particleCount: 150,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#3ddc84', '#ffffff', '#f26e1d']
          });
      }
  }, [status]);

  // Listener for replacements
  useEffect(() => {
      if (!sessionId || !reportId) return;
      const unsub = onSnapshot(doc(db, `sessions/${sessionId}/reports/${reportId}`), (snap) => {
          if (snap.exists()) {
              const data = snap.data() as any;
              if (data.status === 'resolved' && data.newCode) {
                  setOldCode(redeemedCode); // Save the bad code for investigation
                  setRedeemedCode(data.newCode);
                  const storageKey = `pogo_claim_session_${sessionId}`;
                  localStorage.setItem(storageKey, data.newCode);
                  localStorage.setItem('pogo_last_claim_ts', Date.now().toString());
                  localStorage.removeItem(`pogo_pending_report_${sessionId}`);
                  setStatus('success');
                  setReportId(null); 
              }
          }
      });
      return () => unsub();
  }, [sessionId, reportId]);

  const getDeviceId = () => {
    let id = localStorage.getItem('pogo_device_id');
    if (!id || id === 'host' || id === 'unknown') { 
        id = uuidv4(); 
        localStorage.setItem('pogo_device_id', id); 
    }
    return id;
  };

  useEffect(() => {
    const processClaim = async () => {
      const deviceId = getDeviceId();
      const dateKey = new Date().toISOString().split('T')[0];
      const dailyLimitRef = doc(db, 'daily_limits', `${deviceId}_${dateKey}`);
      const savedIgn = urlIgn || inputIgn || localStorage.getItem('pogo_saved_ign');

      try {
        const storageKey = sessionId ? `pogo_claim_session_${sessionId}` : (codeId ? `pogo_claim_legacy_${codeId}` : '');
        
        // 1. ALWAYS LOAD CACHED CODE FIRST (Fixes Issue #2)
        const cached = storageKey ? localStorage.getItem(storageKey) : null;
        if (cached) {
            setRedeemedCode(cached);
        }

        // 2. CHECK FOR PERSISTENT REPORT
        const pendingReportId = sessionId ? localStorage.getItem(`pogo_pending_report_${sessionId}`) : null;
        if (pendingReportId) {
            setReportId(pendingReportId);
            setStatus('waiting_fix');
            // We still need to fetch session/ambassador info to show logos/names
            if (sessionId) {
                const snap = await getDoc(doc(db, 'sessions', sessionId));
                if (snap.exists()) {
                    const d = snap.data() as SessionData;
                    setAmbassadorInfo(d.ambassador);
                    setIsSessionActive(d.active);
                }
            }
            return;
        }

        // 3. IF NO REPORT BUT HAS CACHE, WE ARE DONE
        if (cached) {
            if (sessionId) {
                const snap = await getDoc(doc(db, 'sessions', sessionId));
                if (snap.exists()) {
                    const d = snap.data() as SessionData;
                    setAmbassadorInfo(d.ambassador);
                    if (d.ambassador?.notes) setActiveSlide('WELCOME');
                    setIsSessionActive(d.active);
                    
                    if (d.isIssueMode) {
                        setShowIssueModeConfirm(true);
                    }
                }
            }
            setStatus('success');
            return;
        }

        // 4. PERFORM NEW CLAIM
        if (sessionId) {
            const sessionRef = doc(db, 'sessions', sessionId);
            const sessionSnap = await getDoc(sessionRef);
            if (!sessionSnap.exists() || !sessionSnap.data().active) { setStatus('session_expired'); setIsSessionActive(false); return; }
            const sessionData = sessionSnap.data() as SessionData;
            setAmbassadorInfo(sessionData.ambassador);
            if (sessionData.paused) { setStatus('paused'); return; }
            
            if (!isRaffleWin && !sessionData.isTestSession && !sessionData.removeDailyLimit) {
                const limitSnap = await getDoc(dailyLimitRef);
                if (limitSnap.exists() && limitSnap.data().count >= 1) { setStatus('limit_reached'); return; }
            }

            // MANDATORY IGN CHECK
            const currentIgn = localStorage.getItem('pogo_saved_ign');
            let isAnonymousClaim = false;
            if (!currentIgn || currentIgn === 'Trainer') {
                 let anonClaims = parseInt(localStorage.getItem('pogo_anonymous_claims_count') || '0', 10);
                 if (isNaN(anonClaims)) anonClaims = 0; // Failsafe for corrupted local storage
                 if (anonClaims >= 2) {
                     setShowNameModal(true);
                     return; 
                 }
                 isAnonymousClaim = true;
            }

            // RETRY LOGIC FOR ROBUST CLAIMING
            let attempt = 0;
            let success = false;
            const maxAttempts = 3;

            while (attempt < maxAttempts && !success) {
                try {
                    // 1. Jitter to prevent collision (increases with attempts)
                    await new Promise(resolve => setTimeout(resolve, Math.random() * (500 + attempt * 500)));

                    // 2. Fetch batch of codes
                    const q = query(
                        collection(db, `sessions/${sessionId}/codes`), 
                        where("claimed", "==", false), 
                        orderBy("dateAdded", "asc"),
                        limit(20)
                    );
                    const snapshot = await getDocs(q);
                    if (snapshot.empty) throw new Error("EMPTY_POOL");

                    // 3. Pick random code
                    const randomIndex = Math.floor(Math.random() * snapshot.docs.length);
                    const codeDocToClaim = snapshot.docs[randomIndex];
                    let claimedValue = '';

                    // 4. Transaction
                    await runTransaction(db, async (transaction: any) => {
                        const freshS = await transaction.get(sessionRef);
                        const freshCode = await transaction.get(codeDocToClaim.ref);

                        if (!freshS.exists() || !freshS.data().active || freshS.data().paused) throw new Error("TRANS_ABORT");
                        if (freshS.data().distributionCap > 0 && (freshS.data().claimedCount || 0) >= freshS.data().distributionCap) throw new Error("EMPTY_POOL");
                        if (freshCode.exists() && freshCode.data().claimed) throw new Error("CODE_TAKEN");

                        transaction.update(codeDocToClaim.ref, {
                            claimed: true, claimedBy: deviceId, claimedAt: serverTimestamp(),
                            claimedByIgn: savedIgn || null, source: isRaffleWin ? 'raffle_win' : 'direct_scan'
                        });
                        transaction.update(sessionRef, { claimedCount: increment(1) });
                        if (!isRaffleWin && !sessionData.isTestSession && !sessionData.removeDailyLimit) {
                            transaction.set(dailyLimitRef, { count: increment(1), lastUpdated: serverTimestamp() }, { merge: true });
                        }
                        claimedValue = codeDocToClaim.data().value;
                    });

                    // 5. Success Side Effects
                    setRedeemedCode(claimedValue);
                    localStorage.setItem(storageKey, claimedValue);
                    localStorage.setItem('pogo_last_claim_ts', Date.now().toString());
                    if (isAnonymousClaim) {
                        let anonClaims = parseInt(localStorage.getItem('pogo_anonymous_claims_count') || '0', 10);
                        if (isNaN(anonClaims)) anonClaims = 0;
                        localStorage.setItem('pogo_anonymous_claims_count', (anonClaims + 1).toString());
                    }
                    success = true;

                } catch (err: any) {
                    console.warn(`Claim attempt ${attempt + 1} failed:`, err.message);
                    if (err.message === "EMPTY_POOL" || err.message === "TRANS_ABORT") throw err; // Fatal errors
                    attempt++;
                }
            }

            if (!success) throw new Error("MAX_RETRIES");
            if (sessionData.ambassador?.notes) setActiveSlide('WELCOME');
            
            setStatus('success');
        }
      } catch (e: any) { setStatus(e.message === "EMPTY_POOL" ? 'empty' : 'error'); }
    };
    const t = setTimeout(processClaim, 1500);
    return () => clearTimeout(t);
  }, [sessionId, inputIgn]);

  const handleCopy = () => { navigator.clipboard.writeText(redeemedCode); addToast('Copied to clipboard!', 'success'); };
  const handleOpenNiantic = () => window.open(`https://store.pokemongo.com/offer-redemption?passcode=${redeemedCode}`, '_blank');
  const handleFlagClick = () => isSessionActive ? setShowCooldownWarning(true) : addToast("Session has ended. Reports are no longer being accepted.", 'warning');

  const handleSaveName = () => {
      if(!tempName.trim()) return;
      localStorage.setItem('pogo_saved_ign', tempName.trim());
      if (tempNickname.trim()) localStorage.setItem('pogo_saved_name', tempNickname.trim());
      
      setInputIgn(tempName.trim()); // This triggers useEffect re-run
      setShowNameModal(false);
  };

  const handleSubmitReport = async () => {
      if (!sessionId || !redeemedCode) return;
      setIsReporting(true);
      try {
          // Use Deterministic ID: Session + Device (Fixes Issue #1)
          const customReportId = `${sessionId}_${getDeviceId()}`;
          await setDoc(doc(db, `sessions/${sessionId}/reports`, customReportId), {
              id: customReportId,
              sessionId,
              deviceId: getDeviceId(),
              badCode: redeemedCode,
              status: 'pending',
              timestamp: Date.now(),
              ign: inputIgn || localStorage.getItem('pogo_saved_ign') || 'Trainer'
          });
          setReportId(customReportId);
          localStorage.setItem(`pogo_pending_report_${sessionId}`, customReportId);
          setStatus('waiting_fix');
      } catch (e) {
          addToast("Failed to submit report. Check connection.", 'error');
      } finally {
          setIsReporting(false);
          setShowReportConfirm(false);
      }
  };

  const handleCancelReport = async () => {
      if (sessionId) {
          if (reportId) {
              try {
                  // Synchronize cancellation with DB
                  await updateDoc(doc(db, `sessions/${sessionId}/reports/${reportId}`), {
                      status: 'cancelled'
                  });
              } catch (e) { console.error("Error updating report status", e); }
          }
          localStorage.removeItem(`pogo_pending_report_${sessionId}`);
          setReportId(null);
          setStatus('success'); // redeemedCode is still in state, so it works!
      }
  };

  const renderStatusContent = () => {
    return (
      <div className="flex flex-col items-center pt-6 pb-2">
          {status === 'claiming' && (
            <div className="flex flex-col items-center space-y-6 py-8">
                <MotionDiv animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                    <Loader2 size={48} className="text-primary" />
                </MotionDiv>
                <h2 className="text-xl font-bold">Fetching Code...</h2>
            </div>
          )}

          {status === 'success' && (
            <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full text-center">
                <div className="flex justify-center mb-4">
                    <img src="https://app.fullertonpogo.com/images/happy-pika.gif" className="w-32 h-32 object-contain drop-shadow-lg" alt="Happy Pika" />
                </div>
                <h2 className="text-3xl font-black mb-1 uppercase tracking-tighter italic">Trainer Reward</h2>
                <p className="text-gray-400 text-sm mb-6">Your exclusive promo code is ready!</p>
                <div className="bg-[#0B0F19] p-6 mb-8 border border-gray-800 shadow-inner relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-green-500/30 to-transparent" />
                    <div className="font-mono text-2xl tracking-[0.15em] font-black text-white select-all break-all relative z-10 group-hover:scale-105 transition-transform">{redeemedCode}</div>
                    <div className="absolute -right-4 -bottom-4 opacity-10"><Ticket size={64}/></div>
                </div>
                
                {oldCode && (
                    <div className="bg-red-900/20 border border-red-500/30 p-3 mb-6">
                        <p className="text-xs text-red-400 font-bold uppercase tracking-wider mb-1">Previous Code (Invalid)</p>
                        <p className="font-mono text-sm text-red-300/70 line-through select-all">{oldCode}</p>
                    </div>
                )}
                
                {/* Raffle Entry Badge Removed */}

                <Button variant="niantic" fullWidth onClick={handleOpenNiantic} icon={<ExternalLink size={20}/>} className="mb-2 h-16 text-xl font-black shadow-xl animate-pulse-slow">Redeem Now</Button>
                <p className="text-[10px] text-gray-500 mb-4">Opens in new tab. Come back here after!</p>

                <div className="flex gap-2">
                    <Button variant="secondary" fullWidth onClick={handleCopy} icon={<Copy size={16}/>} className="h-11 text-xs">Copy</Button>
                    <Button variant="secondary" fullWidth onClick={() => setShowTransferQR(true)} icon={<QrCode size={16}/>} className="h-11 text-xs">Share</Button>
                </div>
            </MotionDiv>
          )}

          {status === 'waiting_fix' && (
            <MotionDiv initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full text-center py-4">
                <div className="flex justify-center mb-4">
                    <img src="https://app.fullertonpogo.com/images/pika-sad.gif" className="w-32 h-32 object-contain drop-shadow-lg opacity-90" alt="Waiting" />
                </div>
                <h2 className="text-2xl font-black uppercase italic text-orange-500 mb-2">Issue Reported</h2>
                <p className="text-gray-400 text-sm mb-8 leading-relaxed px-2">Please stay on this screen. Your Ambassador is preparing a fresh code for you now.</p>
                <div className="space-y-3">
                    <div className="bg-gray-800/50 p-4 border border-gray-700 flex items-center gap-4 text-left">
                        <div className="p-2 bg-orange-500/10 rounded-full shrink-0"><Loader2 size={20} className="text-orange-500 animate-spin" /></div>
                        <div>
                            <div className="text-xs font-bold text-white uppercase tracking-wider">Syncing with Host...</div>
                            <div className="text-[10px] text-gray-500 italic">Page will auto-update</div>
                        </div>
                    </div>
                    <Button variant="ghost" fullWidth onClick={handleCancelReport} icon={<XCircle size={16}/>} className="text-gray-500 text-xs">
                        Cancel Report (Fixed Manually)
                    </Button>
                </div>
            </MotionDiv>
          )}

          {status === 'empty' && (
            <div className="flex flex-col items-center space-y-4 py-4">
                <img src="https://app.fullertonpogo.com/images/pika-nomo.gif" className="w-32 h-32 object-contain drop-shadow-lg mb-4" alt="Empty" />
                <h2 className="text-2xl font-black uppercase italic">Stash is empty!</h2>
                <p className="text-gray-400 text-sm">All codes for this session have been claimed.</p>
                <Button variant="secondary" className="mt-4" onClick={() => window.location.reload()}>Check Again</Button>
            </div>
          )}

          {status === 'session_expired' && (
            <div className="flex flex-col items-center space-y-4 py-4 px-2">
                <Clock size={48} className="text-gray-600 mb-2" />
                <h2 className="text-2xl font-black uppercase italic">Session Ended</h2>
                <p className="text-gray-400 text-sm">This distribution session has ended.</p>
                <Button variant="secondary" className="mt-4" onClick={() => navigate('/')}>Return Home</Button>
            </div>
          )}

          {status === 'paused' && (
            <div className="flex flex-col items-center space-y-4 py-4 px-2">
                <PauseCircle size={48} className="text-yellow-500 mb-2 animate-pulse" />
                <h2 className="text-2xl font-black uppercase italic text-yellow-500">Session Paused</h2>
                <p className="text-gray-400 text-sm">The Ambassador has temporarily paused distribution.</p>
                <Button variant="secondary" className="mt-4" onClick={() => window.location.reload()}>Refresh</Button>
            </div>
          )}

          {status === 'limit_reached' && (
            <div className="flex flex-col items-center space-y-4 py-4 px-2">
                <img src="https://app.fullertonpogo.com/images/pika-nomo.gif" className="w-32 h-32 object-contain drop-shadow-lg mb-4" alt="Limit Reached" />
                <h2 className="text-2xl font-black uppercase italic text-red-500">Already Claimed!</h2>
                <p className="text-gray-400 text-sm leading-relaxed">You've already claimed a code from this event. Only one per trainer!</p>
                <div className="mt-4 p-3 bg-gray-800/50 border border-gray-700 w-full">
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Last Claimed</p>
                    <p className="text-xs text-gray-300 font-mono">{lastClaimDate || 'Earlier today'}</p>
                </div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center space-y-4 py-4 px-2">
                <img src="https://app.fullertonpogo.com/images/pika-sad.gif" className="w-32 h-32 object-contain drop-shadow-lg mb-4 opacity-80" alt="Error" />
                <h2 className="text-2xl font-black uppercase italic text-orange-500">Sync Error</h2>
                <p className="text-gray-400 text-sm">Connection trouble. Please retry.</p>
                <Button variant="secondary" className="mt-4" onClick={() => window.location.reload()}>Retry</Button>
            </div>
          )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white font-sans relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-green-900/10 via-gray-950 to-black pointer-events-none" />
      
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-start p-6 pt-8 text-center relative z-10">
        <div className="relative max-w-sm w-full bg-gray-900 p-6 border border-gray-800 shadow-2xl mb-8">
            {activeSlide === 'CODE' && status === 'success' && ambassadorInfo?.notes && <button onClick={() => setActiveSlide('WELCOME')} className="absolute top-4 left-4 p-2 bg-gray-800/80 text-gray-400 rounded-full z-20"><ChevronLeft size={16} /></button>}
            {activeSlide === 'CODE' && status === 'success' && sessionId && <button onClick={handleFlagClick} className="absolute top-4 right-4 p-2 bg-red-500/10 text-red-400 rounded-full z-20"><Flag size={14} /></button>}
            
            <AnimatePresence mode="wait">
                {activeSlide === 'WELCOME' ? (
                    <MotionDiv key="welcome" initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }} className="flex flex-col items-center pt-8 pb-4">
                        <div className="w-24 h-24 rounded-full border-4 border-gray-800 shadow-xl mb-4 overflow-hidden bg-black flex items-center justify-center">
                            {ambassadorInfo?.groupLogo ? <img src={ambassadorInfo.groupLogo} className="w-full h-full object-cover" /> : <Ticket className="text-gray-600" size={40}/>}
                        </div>
                        <h2 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Welcome to</h2>
                        <h1 className="text-2xl font-black mb-6 leading-tight">{ambassadorInfo?.communityName}</h1>
                        <div className="bg-white/5 border border-white/20 p-6 relative mx-2 mb-6">
                            <Quote size={20} className="absolute top-4 left-4 text-white/10 rotate-180" />
                            <p className="text-sm italic text-center leading-relaxed relative z-10 px-2">"{ambassadorInfo?.notes}"</p>
                            <Quote size={20} className="absolute bottom-4 right-4 text-white/10" />
                        </div>
                        <Button fullWidth onClick={() => setActiveSlide('CODE')} className="h-16 text-xl font-bold">Reveal Reward <ArrowRight size={20} /></Button>
                    </MotionDiv>
                ) : <MotionDiv key="code" className="w-full">{renderStatusContent()}</MotionDiv>}
            </AnimatePresence>
        </div>
        
        {status === 'success' && (
            <div className="max-w-sm w-full p-4 bg-gray-900/50 border border-gray-800 text-left">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest mb-1"><Info size={12}/> Pro Tip</div>
                <p className="text-[10px] text-gray-500 leading-tight">Redeem quickly! Accounts are often restricted to 1 code per week. If the store says you "don't qualify", your account might be on cooldown.</p>
            </div>
        )}
      </div>

      <Footer />

      <AnimatePresence>{showTransferQR && <MotionDiv className="fixed inset-0 z-[100] bg-gray-950/95 flex flex-col items-center justify-center p-6"><div className="bg-white p-6 mb-8 shadow-2xl"><QRCodeSVG value={`https://store.pokemongo.com/offer-redemption?passcode=${redeemedCode}`} size={250} /></div><Button variant="secondary" onClick={() => setShowTransferQR(false)} icon={<X size={20}/>}>Close</Button></MotionDiv>}</AnimatePresence>
      <AnimatePresence>{showCooldownWarning && <MotionDiv className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6"><div className="bg-gray-900 border border-yellow-500/50 p-8 w-full max-w-sm text-center shadow-2xl"><AlertTriangle className="text-yellow-500 mx-auto mb-4" size={48} /><h3>Heads Up!</h3><p className="text-sm text-gray-300 mb-6">{ambassadorInfo?.limitWarning}</p><div className="space-y-3"><Button fullWidth variant="danger" className="h-14 text-lg font-bold shadow-lg animate-pulse-slow" onClick={() => { setShowCooldownWarning(false); setShowReportConfirm(true); }}>Report a real issue</Button><Button fullWidth variant="secondary" onClick={() => setShowCooldownWarning(false)}>No issue</Button></div></div></MotionDiv>}</AnimatePresence>
      <AnimatePresence>{showReportConfirm && <MotionDiv className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6"><div className="bg-gray-900 p-8 w-full max-w-sm text-center border border-red-500/20 shadow-2xl"><h3>Confirm Issue Report</h3><p className="text-xs text-gray-400 mb-8">This will notify the ambassador that this code is invalid. Misuse of reports may result in event bans.</p><div className="flex gap-3"><Button variant="secondary" onClick={() => !isReporting && setShowReportConfirm(false)} fullWidth>Cancel</Button><Button variant="danger" fullWidth onClick={handleSubmitReport} disabled={isReporting}>{isReporting ? <Loader2 className="animate-spin"/> : 'Submit'}</Button></div></div></MotionDiv>}</AnimatePresence>
      <AnimatePresence>{showIssueModeConfirm && <MotionDiv className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6"><div className="bg-gray-900 border border-red-500/50 p-8 w-full max-w-sm text-center shadow-2xl"><AlertCircle className="text-red-500 mx-auto mb-4" size={48} /><h3>Issue Acknowledged</h3><p className="text-sm text-gray-300 mb-6">The Ambassador has acknowledged your issue. Would you like to request a replacement code?</p><div className="space-y-3"><Button fullWidth variant="danger" className="h-14 text-lg font-bold shadow-lg animate-pulse-slow" onClick={() => { setShowIssueModeConfirm(false); handleSubmitReport(); }} disabled={isReporting}>{isReporting ? <Loader2 className="animate-spin"/> : 'Request New Code'}</Button><Button fullWidth variant="secondary" onClick={() => setShowIssueModeConfirm(false)}>Cancel</Button></div></div></MotionDiv>}</AnimatePresence>
      
      {/* MANDATORY NAME MODAL */}
      <AnimatePresence>
          {showNameModal && (
              <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-6">
                  <div className="bg-gray-900 border border-purple-500/30 p-8 w-full max-w-sm text-center shadow-2xl">
                      <div className="w-16 h-16 bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-purple-500/50">
                          <User size={32} className="text-purple-400" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">Trainer Check-In</h3>
                      <p className="text-sm text-gray-400 mb-6">Almost there! Just drop your Trainer Name so we know who's claiming this reward. This helps us assist you if there are any issues with the code.</p>
                      
                      <div className="space-y-3 mb-6">
                        <div>
                            <label className="text-xs text-gray-500 font-bold uppercase block mb-1 text-left ml-1">Trainer Name (IGN)</label>
                            <div className="relative">
                                <Gamepad2 className="absolute left-3 top-3.5 text-gray-600" size={18} />
                                <input 
                                    type="text" 
                                    value={tempName}
                                    onChange={(e) => setTempName(e.target.value)}
                                    placeholder="Username"
                                    className="w-full bg-gray-950 border border-gray-800 py-3 pl-10 pr-4 outline-none focus:border-purple-500 placeholder-gray-700 text-white"
                                    maxLength={16}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-gray-500 font-bold uppercase block mb-1 text-left ml-1">Your Name (Nickname)</label>
                            <div className="relative">
                                <User className="absolute left-3 top-3.5 text-gray-600" size={18} />
                                <input 
                                    type="text" 
                                    value={tempNickname}
                                    onChange={(e) => setTempNickname(e.target.value)}
                                    placeholder="Nickname (Optional)"
                                    className="w-full bg-gray-950 border border-gray-800 py-3 pl-10 pr-4 outline-none focus:border-purple-500 placeholder-gray-700 text-white"
                                    maxLength={16}
                                />
                            </div>
                        </div>
                      </div>
                      
                      <Button fullWidth onClick={handleSaveName} disabled={!tempName.trim()} className="bg-purple-600 hover:bg-purple-500 border-none">
                          Get My Code!
                      </Button>
                  </div>
              </MotionDiv>
          )}
      </AnimatePresence>
    </div>
  );
};
