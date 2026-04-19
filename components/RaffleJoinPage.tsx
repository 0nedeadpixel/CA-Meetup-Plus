
import React, { useState, useEffect, useRef } from 'react';
// @ts-ignore
import { useParams, useNavigate } from 'react-router-dom';
// @ts-ignore
import { doc, onSnapshot, addDoc, collection, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Button } from './Button';
import { motion, AnimatePresence } from 'framer-motion';
// Added missing 'Users' icon to imports
import { Trophy, User, Users, Gamepad2, Loader2, PartyPopper, Frown, Shield, Gift, Clock, Hash, Lock, Home, Zap, ExternalLink, AlertTriangle, Star, QrCode, X, Edit2, Ban } from 'lucide-react';
import confetti from 'canvas-confetti';
import { QRCodeSVG } from 'qrcode.react';
import { v4 as uuidv4 } from 'uuid';
import { PrivacyModal } from './PrivacyModal';
import { AmbassadorSettings, RafflePrize } from '../types';
import { useToast } from './ToastContext';

const MotionDiv = motion.div as any;

import { Footer } from './Footer';

export const RaffleJoinPage: React.FC = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [step, setStep] = useState<'CHECKING' | 'JOIN' | 'WAITING' | 'WINNER' | 'LOSER' | 'BANNED' | 'ENDED'>('CHECKING');
  
  const [name, setName] = useState('');
  const [ign, setIgn] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);
  
  // Winning Info
  const [prizeName, setPrizeName] = useState('');
  const [activePrizeName, setActivePrizeName] = useState('');
  const [isGrandPrize, setIsGrandPrize] = useState(false);
  const [isDigitalPrize, setIsDigitalPrize] = useState(false);
  const [isSpecialPrize, setIsSpecialPrize] = useState(false);
  const [isCodeReleased, setIsCodeReleased] = useState(false);
  const [releasedCodeValue, setReleasedCodeValue] = useState<string | null>(null);

  const [distributorId, setDistributorId] = useState<string | null>(null);
  const [sessionGhostId, setSessionGhostId] = useState<string | null>(null);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [wonAt, setWonAt] = useState<Date | null>(null);
  const [eventName, setEventName] = useState('');
  const [communityLogo, setCommunityLogo] = useState<string | null>(null);
  const [ambassadorProfile, setAmbassadorProfile] = useState<AmbassadorSettings | null>(null);
  const hasWonRef = useRef(false);
  const [sessionPrizes, setSessionPrizes] = useState<RafflePrize[]>([]);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editIgn, setEditIgn] = useState('');
  const [optedOutPrizeIds, setOptedOutPrizeIds] = useState<string[]>([]);

  const getDeviceId = () => {
    let id = localStorage.getItem('pogo_raffle_device_id');
    if (!id) { id = uuidv4(); localStorage.setItem('pogo_raffle_device_id', id); }
    return id;
  };

  useEffect(() => {
      const savedName = localStorage.getItem('pogo_saved_name');
      const savedIgn = localStorage.getItem('pogo_saved_ign');
      if (savedName) setName(savedName);
      if (savedIgn) setIgn(savedIgn);
  }, []);

  useEffect(() => {
    const checkStatus = async () => {
        if (!sessionId) return;
        const deviceId = getDeviceId();
        try {
            // Check by Device ID first
            const q = query(collection(db, `raffle_sessions/${sessionId}/participants`), where("deviceId", "==", deviceId));
            const snap = await getDocs(q);
            
            if (!snap.empty) {
                const data = snap.docs[0].data() as any;
                setName(data.name);
                setIgn(data.ign);
                setMyParticipantId(snap.docs[0].id);
                setOptedOutPrizeIds(data.optedOutPrizeIds || []);
                setStep(prev => (prev === 'WINNER' || prev === 'ENDED') ? prev : 'WAITING'); 
            } else {
                // Fallback: Check by IGN if we have it saved
                const savedIgn = localStorage.getItem('pogo_saved_ign');
                if (savedIgn) {
                    const qIgn = query(collection(db, `raffle_sessions/${sessionId}/participants`), where("ign", "==", savedIgn));
                    const snapIgn = await getDocs(qIgn);
                    if (!snapIgn.empty) {
                        const data = snapIgn.docs[0].data() as any;
                        setName(data.name);
                        setIgn(data.ign);
                        setMyParticipantId(snapIgn.docs[0].id);
                        setOptedOutPrizeIds(data.optedOutPrizeIds || []);
                        setStep(prev => (prev === 'WINNER' || prev === 'ENDED') ? prev : 'WAITING');
                        return;
                    }
                }
                setStep('JOIN'); 
            }
        } catch (e) { setStep('JOIN'); }
    };
    checkStatus();
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || step === 'CHECKING') return;
    const unsub = onSnapshot(doc(db, 'raffle_sessions', sessionId), (snap) => {
        if (snap.exists()) {
            const data = snap.data() as any;
            if (data.prizes) setSessionPrizes(data.prizes);
            if (data.ghostSessionId) setSessionGhostId(data.ghostSessionId);
            if (data.ambassador) {
                setAmbassadorProfile(data.ambassador);
                if (data.ambassador.groupLogo) setCommunityLogo(data.ambassador.groupLogo);
            }
            if (!data.active) { if (!hasWonRef.current && step !== 'WINNER') setStep('ENDED'); return; }
            if (data.raffleName) setEventName(data.raffleName);
            if (data.blockedDeviceIds && data.blockedDeviceIds.includes(getDeviceId())) { setStep('BANNED'); return; }
            if (data.currentPrize) setActivePrizeName(data.currentPrize);
            if (hasWonRef.current) return;
            if (data.status === 'WINNER_DECLARED') { if (data.winnerId !== myParticipantId) setStep('LOSER'); } 
            else if (data.status === 'WAITING' || data.status === 'ROLLING') { if (myParticipantId && !hasWonRef.current) setStep('WAITING'); }
        } else { setStep('ENDED'); }
    });
    return () => unsub();
  }, [sessionId, step, myParticipantId]);

  useEffect(() => {
      if (!sessionId || !myParticipantId) return;
      const unsubMe = onSnapshot(doc(db, `raffle_sessions/${sessionId}/participants/${myParticipantId}`), (snap) => {
          if (!snap.exists()) { setMyParticipantId(null); hasWonRef.current = false; setStep('JOIN'); } 
          else {
              const data = snap.data() as any;
              if (data.isWinner) {
                  hasWonRef.current = true;
                  const myPrizeName = data.wonPrize || "a prize";
                  setPrizeName(myPrizeName);
                  const prizeDetail = sessionPrizes.find(p => p.name === myPrizeName);
                  if (prizeDetail) {
                      setIsGrandPrize(prizeDetail.isGrandPrize || false);
                      setIsDigitalPrize(prizeDetail.isDigitalCode || false);
                      setIsSpecialPrize(prizeDetail.isSpecial || false);
                      if (prizeDetail.distributorSessionId) setDistributorId(prizeDetail.distributorSessionId);
                  }
                  setIsCodeReleased(data.isReleased || false);
                  setReleasedCodeValue(data.releasedCode || null);
                  if (data.wonAt) setWonAt(new Date(data.wonAt.seconds * 1000));
                  if (step !== 'WINNER') { setStep('WINNER'); triggerWinEffects(isGrandPrize || isSpecialPrize); }
              } else {
                  // Update local data if changed by host or self
                  if (data.name) setName(data.name);
                  if (data.ign) setIgn(data.ign);
                  if (data.optedOutPrizeIds) setOptedOutPrizeIds(data.optedOutPrizeIds);
              }
          }
      });
      return () => unsubMe();
  }, [sessionId, myParticipantId, step, sessionPrizes]);

  const triggerWinEffects = (grand: boolean) => {
      if (navigator.vibrate) navigator.vibrate([500, 100, 500, 100, 1000]);
      const end = Date.now() + (grand ? 5000 : 3000);
      const colors = grand ? ['#FFD700', '#FFA500', '#FFFFFF'] : ['#a855f7', '#ec4899'];
      (function frame() {
        confetti({ particleCount: grand ? 10 : 5, angle: 60, spread: 55, origin: { x: 0 }, colors });
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors });
        if (Date.now() < end) requestAnimationFrame(frame);
      }());
  };

  const handleJoin = async () => {
    if (!name.trim() || !ign.trim() || !sessionId || !hasAgreed) return;
    setIsSubmitting(true);
    localStorage.setItem('pogo_saved_name', name.trim());
    localStorage.setItem('pogo_saved_ign', ign.trim());
    try {
        const myDeviceId = getDeviceId();
        const qIgn = query(collection(db, `raffle_sessions/${sessionId}/participants`), where("ign", "==", ign.trim()));
        const snapIgn = await getDocs(qIgn);
        if (snapIgn.docs.find(d => (d.data() as any).deviceId !== myDeviceId)) {
            addToast("This Trainer Name is already in the raffle!", 'error');
            setIsSubmitting(false);
            return;
        }
        const docRef = await addDoc(collection(db, `raffle_sessions/${sessionId}/participants`), {
            deviceId: myDeviceId, name: name.trim(), ign: ign.trim(), joinedAt: serverTimestamp(), isWinner: false
        });
        setMyParticipantId(docRef.id);
        setStep('WAITING');
    } catch (e: any) { setIsSubmitting(false); }
  };

  const handleClaimDigitalCode = () => {
      if (isSpecialPrize && releasedCodeValue) {
          window.open(`https://store.pokemongo.com/offer-redemption?passcode=${releasedCodeValue}`, '_blank');
          return;
      }
      const targetDistId = distributorId || sessionGhostId;
      if (!targetDistId) { addToast("Session data unavailable.", 'error'); return; }
      const baseUrl = window.location.origin + window.location.pathname;
      const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      window.open(`${cleanBase}/#/session/${targetDistId}?raffleWin=1&ign=${encodeURIComponent(ign)}`, '_blank');
  };

  const handleUpdateProfile = async () => {
      if (!sessionId || !myParticipantId || !editName.trim() || !editIgn.trim()) return;
      try {
          // Check IGN uniqueness if changed
          if (editIgn.trim() !== ign) {
              const qIgn = query(collection(db, `raffle_sessions/${sessionId}/participants`), where("ign", "==", editIgn.trim()));
              const snapIgn = await getDocs(qIgn);
              if (!snapIgn.empty && snapIgn.docs[0].id !== myParticipantId) {
                  addToast("This Trainer Name is already taken!", 'error');
                  return;
              }
          }

          // @ts-ignore
          await import('firebase/firestore').then(({ updateDoc, doc }) => {
             updateDoc(doc(db, `raffle_sessions/${sessionId}/participants/${myParticipantId}`), {
                 name: editName.trim(),
                 ign: editIgn.trim()
             });
          });
          
          setName(editName.trim());
          setIgn(editIgn.trim());
          localStorage.setItem('pogo_saved_name', editName.trim());
          localStorage.setItem('pogo_saved_ign', editIgn.trim());
          setIsEditing(false);
      } catch (e) { addToast("Failed to update profile.", 'error'); }
  };

  const handleOptOutToggle = async () => {
      if (!sessionId || !myParticipantId || !activePrizeName) return;
      const activePrize = sessionPrizes.find(p => p.name === activePrizeName);
      if (!activePrize) return;

      const isOptingOut = !optedOutPrizeIds.includes(activePrize.id);
      let newOptOuts = [...optedOutPrizeIds];
      
      if (isOptingOut) {
          newOptOuts.push(activePrize.id);
      } else {
          newOptOuts = newOptOuts.filter(id => id !== activePrize.id);
      }

      try {
          // @ts-ignore
          await import('firebase/firestore').then(({ updateDoc, doc }) => {
             updateDoc(doc(db, `raffle_sessions/${sessionId}/participants/${myParticipantId}`), {
                 optedOutPrizeIds: newOptOuts
             });
          });
          setOptedOutPrizeIds(newOptOuts);
      } catch (e) { addToast("Failed to update opt-out status.", 'error'); }
  };

  const renderFooter = (isWinnerMode: boolean = false) => (
      <div className={`w-full z-10 shrink-0 ${isWinnerMode ? 'opacity-50' : ''}`}>
          <Footer />
      </div>
  );

  if (step === 'CHECKING') return <div className="h-[100dvh] bg-gray-950 p-6 flex flex-col items-center justify-center text-white"><Loader2 className="animate-spin text-purple-500 mb-4" size={48} /><p className="text-gray-400 text-sm">Checking status...</p></div>;

  return (
    <div className="h-[100dvh] w-full bg-gray-950 flex flex-col overflow-hidden">
        {step === 'JOIN' && (
            <>
                <div className="flex-1 overflow-y-auto p-6 pt-12 flex flex-col items-center justify-start">
                    <div className="w-full max-w-sm mx-auto">
                        <div className="flex justify-center mb-6"><div className="w-24 h-24 bg-purple-900/30 rounded-full flex items-center justify-center border-2 border-purple-500 overflow-hidden shadow-xl">{communityLogo ? <img src={communityLogo} className="w-full h-full object-cover" /> : <Trophy className="text-purple-400" size={32} />}</div></div>
                        <h1 className="text-2xl font-bold text-center mb-2">Join the Raffle</h1><p className="text-gray-400 text-center text-sm mb-8">Enter your details for a chance to win.</p>
                        <div className="space-y-4 w-full">
                            <div><label className="text-xs text-gray-500 font-bold uppercase ml-1 mb-1 block">Trainer Name (IGN)</label><div className="relative"><Gamepad2 className="absolute left-3 top-3.5 text-gray-600" size={18} /><input type="text" value={ign} onChange={(e) => setIgn(e.target.value)} className="w-full bg-gray-900 border border-gray-800 py-3 pl-10 pr-4 outline-none focus:border-purple-500 placeholder-gray-700 text-white" placeholder="Username" /></div></div>
                            <div><label className="text-xs text-gray-500 font-bold uppercase ml-1 mb-1 block">Your Name</label><div className="relative"><User className="absolute left-3 top-3.5 text-gray-600" size={18} /><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-gray-900 border border-gray-800 py-3 pl-10 pr-4 outline-none focus:border-purple-500 placeholder-gray-700 text-white" placeholder="Nickname" /></div></div>
                            <div className="flex items-start gap-3 p-3 bg-gray-900/50 border border-gray-800 cursor-pointer" onClick={() => setHasAgreed(!hasAgreed)}><div className={`mt-0.5 shrink-0 w-5 h-5 border flex items-center justify-center transition-colors ${hasAgreed ? 'bg-purple-600 border-purple-500' : 'border-gray-700'}`}>{hasAgreed && <Shield className="text-white" size={12} />}</div><p className="text-[10px] text-gray-400 leading-tight">I agree to the collection of my data for this event.</p></div>
                            <Button variant="purple" fullWidth onClick={handleJoin} disabled={isSubmitting || !name || !ign || !hasAgreed} className="mt-4">{isSubmitting ? <Loader2 className="animate-spin" /> : 'Enter Raffle'}</Button>
                        </div>
                    </div>
                </div>
                {renderFooter()}
            </>
        )}

        {step === 'WINNER' && (
            <div className={`h-full w-full flex flex-col ${isGrandPrize ? 'bg-yellow-500 text-black' : isSpecialPrize ? 'bg-purple-600 text-white' : isDigitalPrize ? 'bg-blue-600 text-white' : 'bg-purple-900 text-white'} transition-colors duration-1000`}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] z-0 from-white/20 via-transparent to-black/20" />
                <div className="flex-1 flex flex-col items-center justify-center p-6 z-10 w-full text-center overflow-y-auto">
                    <MotionDiv initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-32 h-32 bg-white rounded-full flex items-center justify-center mb-6 shadow-2xl shrink-0 border-4 border-white/50">
                        {isSpecialPrize ? <Star size={64} className="text-purple-600 fill-current" /> : isDigitalPrize ? <Zap size={64} className="text-blue-600 fill-current" /> : <PartyPopper size={64} className={isGrandPrize ? "text-yellow-600" : "text-purple-600"} />}
                    </MotionDiv>
                    <div className="mb-2"><div className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">Congratulations</div><h1 className="text-4xl font-black uppercase tracking-tighter drop-shadow-lg leading-none">{name}!</h1></div>
                    <div className={`backdrop-blur-md p-6  border mb-6 w-full max-w-sm shadow-2xl ${isGrandPrize ? 'bg-white/30 border-black/10' : 'bg-black/30 border-white/20'}`}>
                        <p className="text-[10px] uppercase font-bold tracking-widest mb-2 opacity-70">You Won</p>
                        <p className="text-3xl font-bold leading-tight break-words">{prizeName}</p>
                    </div>

                    {isSpecialPrize && !isCodeReleased && (
                        <div className="w-full max-w-sm mb-6 animate-bounce">
                            <div className="bg-white/20 border border-white/30 p-5 text-center shadow-xl">
                                <Users size={40} className="mx-auto mb-3 opacity-80" />
                                <h3 className="font-black text-xl mb-1 uppercase tracking-tighter">Verified Hand-off</h3>
                                <p className="text-sm font-bold opacity-90 leading-tight">Please walk up to the Host to receive your digital reward code!</p>
                            </div>
                        </div>
                    )}

                    {(isDigitalPrize || (isSpecialPrize && isCodeReleased)) && (
                        <div className="w-full max-w-sm mb-6 animate-fade-in-up">
                            {isCodeReleased && releasedCodeValue && (
                                <div className="bg-white text-purple-950 font-mono text-2xl font-black p-4 mb-4 shadow-inner tracking-widest">
                                    {releasedCodeValue}
                                </div>
                            )}
                            <Button 
                                fullWidth 
                                onClick={handleClaimDigitalCode} 
                                disabled={isClaiming || (isSpecialPrize && !isCodeReleased)} 
                                className={`bg-white text-purple-600 border-none h-16 text-lg font-black shadow-2xl flex items-center justify-center gap-3  ${(isSpecialPrize && !isCodeReleased) ? 'hidden' : ''}`}
                            >
                                {isClaiming ? <Loader2 className="animate-spin" /> : <>🎁 Redeem Now <ExternalLink size={18} /></>}
                            </Button>
                        </div>
                    )}

                    {sessionId && myParticipantId && (
                        <div className={`text-left w-full max-w-sm  p-3 flex flex-col gap-1 border ${isGrandPrize ? 'bg-black/10 border-black/10 text-black/70' : 'bg-white/10 border-white/10 text-white/70'}`}>
                            <div className="flex items-center justify-between text-xs border-b border-current pb-1 mb-1 opacity-60"><span className="font-bold uppercase">Verification Pass</span><Lock size={10} /></div>
                            <div className="flex items-center gap-2"><Clock size={12} /><span className="text-xs font-mono font-bold">{wonAt ? wonAt.toLocaleString() : 'Verifying Time...'}</span></div>
                            <div className="flex items-center gap-2"><Hash size={12} /><span className="text-xs font-mono font-bold uppercase">#{myParticipantId.slice(-3)}</span></div>
                        </div>
                    )}
                    
                    {!isDigitalPrize && !isSpecialPrize && <p className="text-sm font-bold animate-bounce opacity-80 mt-8">Show this screen to the host!</p>}
                </div>
                {renderFooter(true)}
            </div>
        )}

        {step === 'LOSER' && (
            <><div className="flex-1 flex flex-col items-center justify-center p-6 text-center"><div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mb-6"><Frown size={32} className="text-gray-600" /></div><h2 className="text-xl font-bold mb-2">Not this time...</h2><p className="text-gray-500 text-center mb-8 leading-relaxed max-w-xs">The winner for <strong className="text-white">{prizeName}</strong> has been picked.<br/>Stay on this page for the next round!</p><div className="flex items-center gap-2 text-xs text-gray-600"><Loader2 className="animate-spin" size={12}/> Waiting for next prize...</div></div>{renderFooter()}</>
        )}

        {step === 'WAITING' && (
            <>
                <div className="flex-1 flex flex-col items-center justify-center p-6">
                    <div className="w-full max-w-sm text-center">
                        <div className="relative mb-8 flex justify-center"><div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full animate-pulse" /><div className="w-24 h-24 rounded-full border-2 border-purple-500/30 flex items-center justify-center relative z-10 bg-gray-900"><Trophy className="text-purple-500" size={40}/></div></div>
                        <h2 className="text-2xl font-bold mb-2">You are in!</h2>
                        <p className="text-gray-400 text-center mb-8">Keep your phone unlocked. If you win, this screen will light up!</p>
                        {activePrizeName && ( 
                            <div className="mb-6 w-full">
                                <MotionDiv initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-purple-900/20 border border-purple-500/30 p-3 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-3">
                                        <Gift size={20} className="text-purple-400" />
                                        <div className="text-left">
                                            <div className="text-[10px] text-purple-300 font-bold uppercase tracking-wide">Next Draw</div>
                                            <div className="font-bold text-white text-sm">{activePrizeName}</div>
                                        </div>
                                    </div>
                                    {sessionPrizes.find(p => p.name === activePrizeName)?.allowOptOut && (
                                        <button 
                                            onClick={handleOptOutToggle}
                                            className={`text-[10px] font-bold px-3 py-1.5  border transition-all ${optedOutPrizeIds.includes(sessionPrizes.find(p => p.name === activePrizeName)?.id || '') ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}
                                        >
                                            {optedOutPrizeIds.includes(sessionPrizes.find(p => p.name === activePrizeName)?.id || '') ? 'Opted Out' : 'Opt Out'}
                                        </button>
                                    )}
                                </MotionDiv> 
                            </div>
                        )}
                        <div className="bg-gray-900 p-4 border border-gray-800 w-full relative group pr-12">
                            <button onClick={() => { setEditName(name); setEditIgn(ign); setIsEditing(true); }} className="absolute top-2 right-2 p-2 text-gray-600 hover:text-white bg-gray-800/50 hover:bg-gray-700 transition-colors"><Edit2 size={14}/></button>
                            <div className="flex justify-between text-sm mb-2 border-b border-gray-800 pb-2"><span className="text-gray-500">Name</span><span className="font-bold">{name}</span></div>
                            <div className="flex justify-between text-sm"><span className="text-gray-500">IGN</span><span className="font-bold text-purple-400">{ign}</span></div>
                        </div>
                        <Button variant="secondary" onClick={() => setIsShareModalOpen(true)} className="mt-6 w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300 hover:text-white"><QrCode size={18} /> Share / Pass it On</Button>
                    </div>
                </div>
                {renderFooter()}
                <AnimatePresence>
                    {isEditing && (
                        <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6 backdrop-blur-sm">
                            <MotionDiv initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-gray-900 border border-gray-800 p-6 w-full max-w-sm shadow-2xl">
                                <h3 className="text-xl font-bold text-white mb-4">Edit Profile</h3>
                                <div className="space-y-4 mb-6">
                                    <div><label className="text-xs text-gray-500 font-bold uppercase ml-1 mb-1 block">Trainer Name (IGN)</label><input type="text" value={editIgn} onChange={(e) => setEditIgn(e.target.value)} className="w-full bg-gray-950 border border-gray-800 p-3 text-white outline-none focus:border-purple-500" /></div>
                                    <div><label className="text-xs text-gray-500 font-bold uppercase ml-1 mb-1 block">Your Name</label><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-gray-950 border border-gray-800 p-3 text-white outline-none focus:border-purple-500" /></div>
                                </div>
                                <div className="flex gap-3">
                                    <Button variant="secondary" onClick={() => setIsEditing(false)} fullWidth>Cancel</Button>
                                    <Button variant="purple" onClick={handleUpdateProfile} fullWidth>Save</Button>
                                </div>
                            </MotionDiv>
                        </MotionDiv>
                    )}
                    {isShareModalOpen && (
                        <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6 backdrop-blur-sm" onClick={() => setIsShareModalOpen(false)}>
                            <MotionDiv initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white p-6 w-full max-w-sm flex flex-col items-center text-center relative shadow-2xl" onClick={(e: any) => e.stopPropagation()}>
                                <button onClick={() => setIsShareModalOpen(false)} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"><X size={20} /></button>
                                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4 text-purple-600"><QrCode size={32} /></div>
                                <h3 className="text-xl font-black text-gray-900 mb-1 uppercase tracking-tight">Pass it On!</h3>
                                <p className="text-gray-500 text-sm mb-6 leading-tight max-w-[200px]">Show this code to a friend nearby so they can join the raffle too.</p>
                                <div className="bg-white p-2 border-2 border-gray-100 shadow-xl mb-6">
                                    <QRCodeSVG value={window.location.href} size={250} level="H" includeMargin={false} />
                                </div>
                                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Scan to Join</div>
                            </MotionDiv>
                        </MotionDiv>
                    )}
                </AnimatePresence>
            </>
        )}

        {step === 'BANNED' && (
            <><div className="flex-1 flex flex-col items-center justify-center p-6 text-center"><div className="w-20 h-20 bg-red-900/20 rounded-full flex items-center justify-center mb-6 border-2 border-red-500"><Shield size={40} className="text-red-500" /></div><h1 className="text-2xl font-bold text-red-500 mb-2">Access Denied</h1><p className="text-gray-400 text-sm max-w-xs">You have been removed from this raffle session by the host.</p></div>{renderFooter()}</>
        )}

        {step === 'ENDED' && (
            <><div className="flex-1 flex flex-col items-center justify-center p-6 text-center"><div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mb-6 border border-gray-800"><Lock size={40} className="text-gray-600" /></div><h1 className="text-2xl font-bold text-white mb-2">Session Closed</h1><p className="text-gray-400 text-sm max-w-xs mb-8">The host has ended this raffle event. Thanks for playing!</p>{name && ( <div className="text-xs text-gray-600 mb-6">Signed in as <span className="text-gray-400">{name}</span></div> )}<Button variant="secondary" onClick={() => navigate('/community', { state: { profile: ambassadorProfile } })} className="flex items-center gap-2"><Home size={18}/> Visit Community Page</Button></div>{renderFooter()}</>
        )}
    </div>
  );
};
