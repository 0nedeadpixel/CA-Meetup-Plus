
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trophy, Sparkles, Shuffle, UserPlus, Trash2, RefreshCw, QrCode, Users, StopCircle, PlayCircle, Gift, CheckCircle, Copy, Download, Link as LinkIcon, AlertTriangle, Ban, RotateCcw, Maximize2, X, Search, Settings, Plus, Star, ClipboardList, Edit2, Crown, ChevronRight, Check, History, Lock, BarChart3, Calendar, Minus, LogOut, ArrowUp, Hash, Zap, Info, FileText, Cloud, CheckSquare, Square } from 'lucide-react';
import { Button } from './Button';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
// @ts-ignore
import { doc, collection, onSnapshot, updateDoc, setDoc, serverTimestamp, getDocs, deleteDoc, arrayUnion, writeBatch, addDoc, query, orderBy, where, getDoc, increment, limit } from 'firebase/firestore';
// @ts-ignore
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';
import confetti from 'canvas-confetti';
import { v4 as uuidv4 } from 'uuid';
import { RafflePrize, RaffleParticipant, AppSettings, RaffleWinner, UserRole, SessionData, CodeItem, RaffleSession } from '../types';
import { ConfirmationModal } from './ConfirmationModal';
import { useToast } from './ToastContext';

// Fix for framer-motion type mismatch
const MotionDiv = motion.div as any;

interface RaffleViewProps {
    settings?: AppSettings;
    codes?: CodeItem[];
    onSyncCodes?: (usedData: {id: string, claimedAt: number, claimedByIgn?: string, source?: 'raffle_win' | 'direct_scan'}[]) => void;
    onRefundCodes?: (ids: string[]) => void;
    onReserveCodes?: (ids: string[]) => void;
}

export const RaffleView: React.FC<RaffleViewProps> = ({ settings, codes = [], onSyncCodes, onRefundCodes, onReserveCodes }) => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // IDENTITY STATE
  const [myDeviceId, setMyDeviceId] = useState<string>('');

  // SESSION STATE
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [raffleName, setRaffleName] = useState<string>(''); 
  const [sessionStep, setSessionStep] = useState<number>(0); 
  const [viewState, setViewState] = useState<'GAME' | 'SETTINGS'>('GAME');
  const [ghostSessionId, setGhostSessionId] = useState<string | null>(null);
  const [linkedDistributorId, setLinkedDistributorId] = useState<string | null>(null);

  // CREATION STATE
  const [newRaffleName, setNewRaffleName] = useState('');

  // DATA STATE
  const [prizes, setPrizes] = useState<RafflePrize[]>([]);
  const [participants, setParticipants] = useState<RaffleParticipant[]>([]);
  const [sessionStatus, setSessionStatus] = useState<'WAITING' | 'ROLLING' | 'WINNER_DECLARED'>('WAITING');
  
  // UI STATE
  const [showQrModal, setShowQrModal] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [prizeInput, setPrizeInput] = useState('');
  const [isGrandPrize, setIsGrandPrize] = useState(false);
  const [allowOptOut, setAllowOptOut] = useState(false);
  const [selectedPrizeId, setSelectedPrizeId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  
  // SPECIAL CODES STATE
  const [showSpecialVault, setShowSpecialVault] = useState(false);
  const [vaultInput, setVaultInput] = useState('');
  const [vaultPrizeName, setVaultPrizeName] = useState('');

  // SETTINGS STATE
  const [presetPrizes, setPresetPrizes] = useState<string[]>(() => {
      const saved = localStorage.getItem('pogo_raffle_presets');
      return saved ? JSON.parse(saved) : ["Sticker", "Pin", "T-Shirt", "Go Plus+"];
  });
  const [newPresetInput, setNewPresetInput] = useState('');

  // TOAST STATE
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // HISTORY & AUTH STATE
  const [showAuthModal, setShowAuthModal] = useState(false); 
  const [showResultsModal, setShowResultsModal] = useState(false); 
  const [secretTaps, setSecretTaps] = useState(0);
  const [adminMenuVisible, setAdminMenuVisible] = useState(false);
  
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<UserRole>('user');
  
  const [winnerHistory, setWinnerHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isGlobalHistory, setIsGlobalHistory] = useState(false);
  
  const [historySessionId, setHistorySessionId] = useState<string | null>(null);
  const [historyParticipants, setHistoryParticipants] = useState<RaffleParticipant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  // BULK DELETE STATE
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [historySelection, setHistorySelection] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  
  // GAMEPLAY STATE
  const [winner, setWinner] = useState<string | null>(null);
  const [winnerDetail, setWinnerDetail] = useState<string | null>(null);
  const [winnerId, setWinnerId] = useState<string | null>(null); 
  const [isRolling, setIsRolling] = useState(false);

  // CONFIRMATION STATE
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [participantToKick, setParticipantToKick] = useState<string | null>(null);
  const [massDrawConfirm, setMassDrawConfirm] = useState<{count: number, prizeName: string} | null>(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    let id = localStorage.getItem('pogo_device_id');
    if (!id || id === 'host' || id === 'unknown') { 
        id = uuidv4(); 
        localStorage.setItem('pogo_device_id', id); 
    }
    setMyDeviceId(id);

    const activeSessionId = localStorage.getItem('pogo_raffle_active_session');
    if (activeSessionId) {
        setSessionId(activeSessionId);
    }
    
    const unsubAuth = onAuthStateChanged(auth, async (user: any) => {
        setCurrentUser(user);
        if (user) {
             try {
                  const snap = await getDoc(doc(db, 'users', user.uid));
                  if (snap.exists()) {
                      const data = snap.data() as any;
                      let r = (data.role || 'user').toLowerCase();
                      if (user.email === 'elmersdesign@gmail.com') r = 'super_admin';
                      setUserRole(r as UserRole);
                  }
              } catch (e) { console.error("Error fetching role", e); }
        } else {
            setUserRole('user');
        }
    });
    return () => unsubAuth();
  }, []);

  // --- ADOPTION LOGIC (Mirroring Trivia Master) ---
  useEffect(() => {
      if (!myDeviceId && !currentUser) return;

      const adoptRaffles = async () => {
          const batch = writeBatch(db);
          let count = 0;

          // 1. ACTIVE SESSION PROTECTION
          if (sessionId) {
              const ref = doc(db, 'raffle_sessions', sessionId);
              const snap = await getDoc(ref);
              if (snap.exists()) {
                  const data = snap.data();
                  if (!data.hostUid || data.hostDevice === 'host') {
                      const updates: any = { hostDevice: myDeviceId };
                      if (currentUser) updates.hostUid = currentUser.uid;
                      batch.update(ref, updates);
                      count++;
                  }
              }
          }

          // 2. ORPHAN ADOPTION (Cloud Link)
          if (currentUser) {
              const q = query(
                  collection(db, 'raffle_sessions'),
                  where('hostDevice', '==', myDeviceId),
                  where('hostUid', '==', null)
              );
              const snap = await getDocs(q);
              snap.forEach(docSnap => {
                  if (!docSnap.data().hostUid) {
                      batch.update(docSnap.ref, { hostUid: currentUser.uid });
                      count++;
                  }
              });
          }

          if (count > 0) {
              console.log(`Raffle Alignment: Linked ${count} sessions to ${currentUser ? currentUser.email : 'Device ' + myDeviceId}`);
              await batch.commit();
          }
      };

      adoptRaffles();
  }, [currentUser, myDeviceId, sessionId]);

  useEffect(() => {
    try {
      const cache = new WeakSet();
      const safeStr = JSON.stringify(presetPrizes, (key, value) => {
        if (value instanceof Element || (typeof Event !== 'undefined' && value instanceof Event) || (value && value.$$typeof)) return undefined;
        if (typeof value === 'object' && value !== null) {
          if (cache.has(value)) return undefined;
          cache.add(value);
        }
        return value;
      });
      localStorage.setItem('pogo_raffle_presets', safeStr);
    } catch(e) {}
  }, [presetPrizes]);

  useEffect(() => {
      if (scrollRef.current) {
          scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
  }, [sessionStep]); 

  useEffect(() => {
      if (!sessionId) {
          setSessionStep(0);
          setRaffleName('');
          return;
      }

      const unsubSession = onSnapshot(doc(db, 'raffle_sessions', sessionId), (docSnap) => {
          if (docSnap.exists()) {
              const data = docSnap.data() as any;
              
              // STRICT PADLOCK: You can ONLY access a live raffle if you created it.
              const isOwner = data.hostUid 
                  ? currentUser && data.hostUid === currentUser.uid
                  : data.hostDevice === myDeviceId;

              if (!isOwner) {
                  addToast("Unauthorized: You cannot access another Host's active raffle.", 'error');
                  setSessionId(null);
                  localStorage.removeItem('pogo_raffle_active_session');
                  return;
              }

              if (data.active === false) {
                  setSessionId(null);
                  localStorage.removeItem('pogo_raffle_active_session');
                  return;
              }
              if (data.prizes) setPrizes(data.prizes);
              if (data.status) setSessionStatus(data.status);
              if (data.raffleName) setRaffleName(data.raffleName); 
              if (data.ghostSessionId) setGhostSessionId(data.ghostSessionId);
              if (data.linkedDistributorId) setLinkedDistributorId(data.linkedDistributorId);
          } else {
              setSessionId(null);
              localStorage.removeItem('pogo_raffle_active_session');
          }
      });

      const unsubParts = onSnapshot(collection(db, `raffle_sessions/${sessionId}/participants`), (snap: any) => {
          const list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as RaffleParticipant));
          setParticipants(list);
      });

      return () => { unsubSession(); unsubParts(); };
  }, [sessionId]);


  // --- SESSION MANAGEMENT ---
  const createSession = async () => {
      if (!newRaffleName.trim()) return;

      const id = uuidv4();
      const communityName = settings?.ambassador?.communityName || 'Unknown Community';

      await setDoc(doc(db, 'raffle_sessions', id), {
          id,
          hostDevice: myDeviceId,
          hostUid: currentUser ? currentUser.uid : null, // CLOUD LINK
          communityName,
          ambassador: settings?.ambassador || null,
          raffleName: newRaffleName.trim(), 
          active: true,
          createdAt: serverTimestamp(),
          status: 'WAITING',
          prizes: [],
          blockedDeviceIds: []
      });
      
      localStorage.setItem('pogo_raffle_active_session', id);
      setSessionId(id);
      setRaffleName(newRaffleName.trim());
      setNewRaffleName('');
      setSessionStep(0);
  };

  const handleEndSessionClick = () => {
      setShowEndSessionModal(true);
  };

  const confirmEndSession = async () => {
      if (!sessionId) return;

      if (ghostSessionId) {
          try {
              await updateDoc(doc(db, 'sessions', ghostSessionId), { active: false });

              const qAllCodes = collection(db, `sessions/${ghostSessionId}/codes`);
              const snapAll = await getDocs(qAllCodes);
              
              const claimedData: {id: string, claimedAt: number, claimedByIgn?: string, source: 'raffle_win'}[] = [];
              const unclaimedIds: string[] = [];

              snapAll.forEach(d => {
                  const data = d.data();
                  if (data.claimed) {
                      claimedData.push({
                          id: data.originalId,
                          claimedAt: data.claimedAt ? (data.claimedAt.seconds * 1000) : Date.now(),
                          claimedByIgn: data.claimedByIgn || 'Anonymous Winner',
                          source: 'raffle_win'
                      });
                  } else {
                      unclaimedIds.push(data.originalId);
                  }
              });

              if (claimedData.length > 0 && onSyncCodes) {
                  onSyncCodes(claimedData);
              }

              if (unclaimedIds.length > 0 && onRefundCodes) {
                  onRefundCodes(unclaimedIds);
              }
          } catch (e) {
              console.error("Error during refund/sync logic:", e);
          }
      }
      
      await updateDoc(doc(db, 'raffle_sessions', sessionId), { active: false });
      localStorage.removeItem('pogo_raffle_active_session');
      setSessionId(null);
      setRaffleName('');
      setSessionStep(0);
      setPrizes([]);
      setParticipants([]);
      setGhostSessionId(null);
  };

  const addPrize = async () => {
      if (!prizeInput.trim() || !sessionId) return;
      
      const newPrize: RafflePrize = {
          id: uuidv4(),
          name: prizeInput.trim(),
          isGrandPrize: isGrandPrize,
          allowOptOut: allowOptOut,
          quantity: 1,
          remaining: 1,
          winners: [],
          isDigitalCode: false
      };
      const updatedPrizes = [...prizes, newPrize];
      await updateDoc(doc(db, 'raffle_sessions', sessionId), { prizes: updatedPrizes });
      setPrizeInput('');
      setIsGrandPrize(false);
      setAllowOptOut(false);
  };

  const addDigitalPrizeQuickly = async () => {
      if (linkedDistributorId) {
          addToast("Digital Prizes are disabled because this raffle is linked to a Distribution Session. Participants are already receiving codes!", 'warning');
          return;
      }

      if (!sessionId || !codes) return;

      const availablePool = codes.filter(c => !c.isUsed && !c.isReserved);
      if (availablePool.length < 1) {
          addToast("No available codes in your stash!", 'warning');
          return;
      }

      let currentGhostId = ghostSessionId;
      const selectedCode = availablePool[0]; 

      try {
          if (!currentGhostId) {
              currentGhostId = uuidv4();
              
              await setDoc(doc(db, 'sessions', currentGhostId), {
                  id: currentGhostId,
                  active: true,
                  paused: false,
                  createdAt: serverTimestamp(),
                  totalCodes: 1,
                  hostDevice: myDeviceId,
                  distributionCap: 1,
                  claimedCount: 0,
                  ambassador: settings?.ambassador || { communityName: '', campfireUrl: '', groupLogo: null, notes: '' },
                  isGhostSession: true,
                  raffleLink: sessionId
              });

              await setDoc(doc(db, `sessions/${currentGhostId}/codes/${selectedCode.id}`), {
                  value: selectedCode.value, claimed: false, originalId: selectedCode.id
              });

              await updateDoc(doc(db, 'raffle_sessions', sessionId), { ghostSessionId: currentGhostId });
          } else {
              await setDoc(doc(db, `sessions/${currentGhostId}/codes/${selectedCode.id}`), {
                  value: selectedCode.value, claimed: false, originalId: selectedCode.id
              });
              await updateDoc(doc(db, 'sessions', currentGhostId), {
                  totalCodes: increment(1),
                  distributionCap: increment(1)
              });
          }

          if (onReserveCodes) {
              onReserveCodes([selectedCode.id]);
          }

          const newPrize: RafflePrize = {
              id: uuidv4(),
              name: "Digital Promo Code",
              isGrandPrize: false,
              quantity: 1,
              remaining: 1,
              winners: [],
              isDigitalCode: true,
              distributorSessionId: currentGhostId
          };
          
          const updatedPrizes = [...prizes, newPrize];
          await updateDoc(doc(db, 'raffle_sessions', sessionId), { prizes: updatedPrizes });
      } catch (e) {
          console.error("Failed mid-game digital allocation", e);
          addToast("Error adding digital prize. Check connection.", 'error');
      }
  };

  const handleAddSpecialVaultCodes = async () => {
      if (!sessionId || !vaultInput.trim()) return;
      
      const newCodes = vaultInput.split(/[\n,]+/).map(c => c.trim()).filter(c => c);
      if (newCodes.length === 0) return;

      const label = vaultPrizeName.trim() || "Special Reward";

      const newPrizes: RafflePrize[] = newCodes.map(val => ({
          id: uuidv4(),
          name: label,
          isGrandPrize: true,
          quantity: 1,
          remaining: 1,
          winners: [],
          isDigitalCode: true,
          isSpecial: true,
          specificCodeValue: val
      }));

      const updatedPrizes = [...prizes, ...newPrizes];
      await updateDoc(doc(db, 'raffle_sessions', sessionId), { prizes: updatedPrizes });
      
      setVaultInput('');
      setVaultPrizeName('');
      setShowSpecialVault(false);
      setToastMessage(`Added ${newCodes.length} ${label} prizes!`);
      setShowToast(true);
  };

  const addPresetPrize = (name: string) => {
      if (!sessionId) return;
      const newPrize: RafflePrize = { 
          id: uuidv4(), 
          name: name, 
          isGrandPrize: false, 
          quantity: 1, 
          remaining: 1, 
          winners: []
      };
      updateDoc(doc(db, 'raffle_sessions', sessionId), { prizes: [...prizes, newPrize] });
  };

  const removePrize = async (prizeId: string) => {
      if (!sessionId) return;
      const prize = prizes.find(p => p.id === prizeId);
      
      // If digital and NOT special, refund from ghost session
      if (prize?.isDigitalCode && !prize.isSpecial && prize.remaining && prize.remaining > 0) {
          const currentGhostId = ghostSessionId || prize.distributorSessionId;
          if (currentGhostId) {
             const q = query(collection(db, `sessions/${currentGhostId}/codes`), where("claimed", "==", false), limit(prize.remaining));
             const snap = await getDocs(q);
             const refundIds: string[] = [];
             for (const d of snap.docs) {
                 refundIds.push(d.data().originalId);
                 await deleteDoc(d.ref);
             }
             if (refundIds.length > 0) {
                 await updateDoc(doc(db, 'sessions', currentGhostId), {
                     totalCodes: increment(-refundIds.length),
                     distributionCap: increment(-refundIds.length)
                 });
                 if (onRefundCodes) onRefundCodes(refundIds);
             }
          }
      }

      const updatedPrizes = prizes.filter(p => p.id !== prizeId);
      await updateDoc(doc(db, 'raffle_sessions', sessionId), { prizes: updatedPrizes });
  };

  const updatePrizeQuantity = async (prizeId: string, delta: number) => {
      if (!sessionId) return;
      
      const prize = prizes.find(p => p.id === prizeId);
      if (!prize || prize.isSpecial) return; // Special codes are always qty 1

      // Handle Decrement (Refund Logic)
      if (prize.isDigitalCode && delta < 0) {
          const wonCount = prize.winners ? prize.winners.length : (prize.winnerId ? 1 : 0);
          if ((prize.quantity || 1) + delta < wonCount) {
              addToast("Cannot reduce quantity below the number of awarded winners.", 'warning');
              return;
          }

          const currentGhostId = ghostSessionId || prize.distributorSessionId;
          if (currentGhostId) {
              try {
                  const q = query(collection(db, `sessions/${currentGhostId}/codes`), where("claimed", "==", false), limit(1));
                  const snap = await getDocs(q);
                  
                  if (!snap.empty) {
                      const docToDelete = snap.docs[0];
                      const originalId = docToDelete.data().originalId;
                      await deleteDoc(docToDelete.ref);
                      await updateDoc(doc(db, 'sessions', currentGhostId), {
                          totalCodes: increment(-1),
                          distributionCap: increment(-1)
                      });
                      if (onRefundCodes) onRefundCodes([originalId]);
                  } else {
                      addToast("No unclaimed codes found in the session to refund.", 'warning');
                      return;
                  }
              } catch (e) {
                  console.error("Failed to refund code", e);
                  addToast("Failed to refund code to stash.", 'error');
                  return;
              }
          }
      }

      // Handle Increment
      if (prize.isDigitalCode && delta > 0) {
          const availablePool = codes.filter(c => !c.isUsed && !c.isReserved);
          if (availablePool.length < delta) {
              addToast("Not enough available codes in your stash!", 'warning');
              return;
          }

          const targetCodes = availablePool.slice(0, delta);
          const currentGhostId = ghostSessionId || prize.distributorSessionId;

          if (currentGhostId) {
              try {
                  const batch = writeBatch(db);
                  targetCodes.forEach(code => {
                      const ref = doc(db, `sessions/${currentGhostId}/codes/${code.id}`);
                      batch.set(ref, { value: code.value, claimed: false, originalId: code.id });
                  });
                  await batch.commit();

                  await updateDoc(doc(db, 'sessions', currentGhostId), {
                      totalCodes: increment(delta),
                      distributionCap: increment(delta)
                  });

                  if (onReserveCodes) {
                      onReserveCodes(targetCodes.map(c => c.id));
                  }
              } catch (e) {
                  console.error("Failed to allocate more codes", e);
                  addToast("Failed to allocate more codes from stash.", 'error');
                  return;
              }
          }
      }

      const updatedPrizes = prizes.map(p => {
          if (p.id === prizeId) {
              const newQty = Math.max(1, (p.quantity || 1) + delta);
              const wonCount = p.winners ? p.winners.length : (p.winnerId ? 1 : 0);
              const newRemaining = Math.max(0, newQty - wonCount);
              return { ...p, quantity: newQty, remaining: newRemaining };
          }
          return p;
      });
      await updateDoc(doc(db, 'raffle_sessions', sessionId), { prizes: updatedPrizes });
  };

  const toggleGrandPrize = async (prizeId: string) => {
      if (!sessionId) return;
      const updatedPrizes = prizes.map(p => 
          p.id === prizeId ? { ...p, isGrandPrize: !p.isGrandPrize } : p
      );
      await updateDoc(doc(db, 'raffle_sessions', sessionId), { prizes: updatedPrizes });
  };

  // --- ENTRY LOGIC ---
  const handleAddPreset = () => {
      if (newPresetInput.trim()) {
          setPresetPrizes([...presetPrizes, newPresetInput.trim()]);
          setNewPresetInput('');
      }
  };

  const addManualEntries = async () => {
      if (!manualInput.trim() || !sessionId) return;
      const names = manualInput.split(/[\n,]+/).map(n => n.trim()).filter(n => n);
      if (names.length === 0) return;
      const batch = writeBatch(db);
      names.forEach(name => {
          const ref = doc(collection(db, `raffle_sessions/${sessionId}/participants`));
          batch.set(ref, {
              deviceId: 'manual',
              name: name,
              ign: name,
              joinedAt: serverTimestamp(),
              isWinner: false,
              isManual: true
          });
      });
      await batch.commit();
      setManualInput('');
      addToast(`Added ${names.length} entries!`, 'success');
  };

  const confirmKickParticipant = async () => {
      if (!participantToKick || !sessionId) return;
      await deleteDoc(doc(db, `raffle_sessions/${sessionId}/participants/${participantToKick}`));
      setParticipantToKick(null);
  };

  // --- DRAW LOGIC ---
  const handleSelectPrize = async (prize: RafflePrize) => {
      setSelectedPrizeId(prize.id);
      setWinner(null); 
      setWinnerDetail(null);
      setWinnerId(null);
      
      if (sessionId) {
          await updateDoc(doc(db, 'raffle_sessions', sessionId), {
              currentPrizeId: prize.id,
              currentPrize: prize.name,
              status: 'WAITING' 
          });
      }
  };

  const pickWinner = async () => {
      if (!selectedPrizeId) { addToast("Select a prize first!", 'warning'); return; }
      const prize = prizes.find(p => p.id === selectedPrizeId);
      if (!prize) return;
      
      if (prize.remaining !== undefined && prize.remaining <= 0) { 
          addToast("This prize has already been fully awarded!", 'warning'); 
          return; 
      }

      const eligible = participants.filter(p => !p.isWinner && (!p.optedOutPrizeIds || !p.optedOutPrizeIds.includes(selectedPrizeId)));
      if (eligible.length === 0) { addToast("No eligible participants left!", 'warning'); return; }

      setIsRolling(true);
      setWinner(null);
      setWinnerDetail(null);
      setWinnerId(null);

      if (sessionId) {
          await updateDoc(doc(db, 'raffle_sessions', sessionId), { 
              status: 'ROLLING',
              currentPrizeId: prize.id,
              currentPrize: prize.name 
          });
      }

      let counter = 0;
      const eligiblePool = eligible;
      const interval = setInterval(() => {
          const rand = eligiblePool[Math.floor(Math.random() * eligiblePool.length)];
          setWinner(rand.ign);
          counter++;
          if (counter > 30) {
              clearInterval(interval);
              finalizeWinner(eligiblePool, prize);
          }
      }, 80);
  };

  const handleMassDrawClick = (count: number) => {
      if (!selectedPrizeId) { addToast("Select a prize first!", 'warning'); return; }
      const prize = prizes.find(p => p.id === selectedPrizeId);
      if (!prize) return;
      
      const remaining = prize.remaining ?? 0;
      if (remaining < count) { 
          addToast(`Not enough prizes left! Only ${remaining} remaining.`, 'warning'); 
          return; 
      }

      const eligible = participants.filter(p => !p.isWinner && (!p.optedOutPrizeIds || !p.optedOutPrizeIds.includes(selectedPrizeId)));
      if (eligible.length < count) { addToast(`Not enough eligible participants! Only ${eligible.length} eligible.`, 'warning'); return; }

      setMassDrawConfirm({ count, prizeName: prize.name });
  };

  const confirmMassDraw = async () => {
      if (!massDrawConfirm || !selectedPrizeId) return;
      const { count } = massDrawConfirm;
      setMassDrawConfirm(null);

      const prize = prizes.find(p => p.id === selectedPrizeId);
      if (!prize) return;

      const eligible = participants.filter(p => !p.isWinner && (!p.optedOutPrizeIds || !p.optedOutPrizeIds.includes(selectedPrizeId)));

      setIsRolling(true);
      setWinner(null);
      setWinnerDetail(null);
      setWinnerId(null);

      if (sessionId) {
          await updateDoc(doc(db, 'raffle_sessions', sessionId), { 
              status: 'ROLLING',
              currentPrizeId: prize.id,
              currentPrize: prize.name 
          });
      }

      setTimeout(async () => {
          const winners: RaffleParticipant[] = [];
          const pool = [...eligible];
          
          for(let i=0; i<count; i++) {
              if (pool.length === 0) break;
              const idx = Math.floor(Math.random() * pool.length);
              winners.push(pool[idx]);
              pool.splice(idx, 1);
          }

          if (!sessionId) return;

          const batch = writeBatch(db);
          const newWinnersList: RaffleWinner[] = [];

          winners.forEach(w => {
              const partRef = doc(db, `raffle_sessions/${sessionId}/participants/${w.id}`);
              const partUpdate: any = { 
                  isWinner: true, 
                  wonPrize: prize.name,
                  wonAt: serverTimestamp(),
              };
              if (prize.isSpecial) {
                  partUpdate.isSpecialWin = true;
                  partUpdate.isReleased = false; 
              }
              batch.update(partRef, partUpdate);

              newWinnersList.push({
                  participantId: w.id,
                  participantName: w.ign,
                  awardedAt: Date.now()
              });
          });

          const sessionRef = doc(db, 'raffle_sessions', sessionId);
          const updatedPrizes = prizes.map(p => {
              if (p.id === prize.id) {
                  const currentWinners = p.winners || [];
                  return { 
                      ...p, 
                      remaining: Math.max(0, (p.quantity || 1) - (currentWinners.length + newWinnersList.length)),
                      winners: [...currentWinners, ...newWinnersList],
                      awardedAt: Date.now()
                  };
              }
              return p;
          });

          batch.update(sessionRef, {
              status: 'WINNER_DECLARED',
              prizes: updatedPrizes,
              winnerName: `${count} Winners`
          });

          await batch.commit();
          
          setIsRolling(false);
          setWinner(`${count} Winners!`);
          setWinnerDetail(winners.map(w => w.ign).join(", "));
          fireConfetti();
      }, 2000);
  };

  const finalizeWinner = async (pool: RaffleParticipant[], prize: RafflePrize) => {
      if (!sessionId) return;
      const w = pool[Math.floor(Math.random() * pool.length)];
      setIsRolling(false);
      setWinner(w.ign);
      setWinnerDetail(w.name);
      setWinnerId(w.id);
      fireConfetti();

      // Update Participant doc
      const partUpdate: any = { 
          isWinner: true, 
          wonPrize: prize.name,
          wonAt: serverTimestamp(),
      };
      
      if (prize.isSpecial) {
          partUpdate.isSpecialWin = true;
          partUpdate.isReleased = false; 
      }

      await updateDoc(doc(db, `raffle_sessions/${sessionId}/participants/${w.id}`), partUpdate);
      
      const newWinner: RaffleWinner = {
          participantId: w.id,
          participantName: w.ign,
          awardedAt: Date.now()
      };
      
      const updatedPrizes = prizes.map(p => {
          if (p.id === prize.id) {
              const currentWinners = p.winners || [];
              const newWinners = [...currentWinners, newWinner];
              return { 
                  ...p, 
                  remaining: Math.max(0, (p.quantity || 1) - newWinners.length),
                  winners: newWinners,
                  winnerId: w.id, 
                  winnerName: w.ign, 
                  awardedAt: Date.now()
              };
          }
          return p;
      });

      await updateDoc(doc(db, 'raffle_sessions', sessionId), { 
          status: 'WINNER_DECLARED', 
          winnerId: w.id, 
          winnerName: w.ign, 
          prizes: updatedPrizes 
      });
  };

  const handleReleaseCode = async (participantId: string, prize: RafflePrize) => {
      if (!sessionId || !prize.specificCodeValue) return;
      
      // Unlock for the participant by giving them the actual code value now
      await updateDoc(doc(db, `raffle_sessions/${sessionId}/participants/${participantId}`), {
          isReleased: true,
          releasedCode: prize.specificCodeValue
      });

      setToastMessage(`Code released for ${prize.winnerName || 'Winner'}!`);
      setShowToast(true);
  };

  // --- HISTORY & AUTH LOGIC ---
  const handleOpenAuthModal = () => {
      setSecretTaps(0);
      setAdminMenuVisible(false);
      setEmailInput('');
      setPasswordInput('');
      setShowAuthModal(true);
  };
  const handleSecretTap = () => {
      const newCount = secretTaps + 1;
      setSecretTaps(newCount);
      if (newCount >= 7) {
          setAdminMenuVisible(true);
          if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
      }
  };
  const handleViewLocal = () => {
      fetchHistory(false);
      setShowAuthModal(false);
      setShowResultsModal(true);
  };
  const handleAdminAuth = async () => {
      if (currentUser && userRole === 'super_admin') {
          fetchHistory(true); 
          setShowAuthModal(false);
          setShowResultsModal(true);
          return;
      }
      if (!emailInput.trim() || !passwordInput.trim()) { addToast("Please enter both email and password.", 'warning'); return; }
      setAuthLoading(true);
      try {
          await signInWithEmailAndPassword(auth, emailInput.trim(), passwordInput);
          fetchHistory(true); 
          setShowAuthModal(false);
          setShowResultsModal(true);
      } catch (e: any) { addToast("Login failed: " + e.message, 'error'); } finally { setAuthLoading(false); }
  };
  
  const handleSignOut = async () => {
      await signOut(auth);
      setShowResultsModal(false);
      setHistorySessionId(null);
  };

  const fetchHistory = async (global: boolean) => {
      setLoadingHistory(true);
      setIsGlobalHistory(global);
      setWinnerHistory([]);
      try {
          const canViewGlobal = global && userRole === 'super_admin';
          if (canViewGlobal) {
               const fourMonthsAgo = new Date();
               fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);
               const q = query(collection(db, 'raffle_sessions'), where("createdAt", ">=", fourMonthsAgo), orderBy("createdAt", "desc"));
               const snap = await getDocs(q);
               processSnap(snap, true);
          } else {
               let q;
               if (currentUser) {
                   // Cloud Sync Mode
                   q = query(collection(db, 'raffle_sessions'), where('hostUid', '==', currentUser.uid));
               } else {
                   // Device ID Mode (Fallback)
                   q = query(collection(db, 'raffle_sessions'), where("hostDevice", "==", myDeviceId));
               }
               const snap = await getDocs(q);
               processSnap(snap, false);
          }
      } catch (e) { console.error(e); setLoadingHistory(false); }
  };

  const processSnap = (snap: any, isGlobalView: boolean) => {
      const historyData: any[] = [];
      snap.forEach((doc: any) => {
          const data = doc.data();
          
          // Filter out other device sessions if not global and not cloud-synced
          if (!isGlobalView && !currentUser && data.hostDevice !== myDeviceId) return;
          
          let displayCommunity = data.communityName || 'Unknown Community';
          if ((!data.communityName || data.communityName === 'Unknown Community') && data.hostDevice === myDeviceId && settings?.ambassador?.communityName) {
              displayCommunity = settings.ambassador.communityName;
          }
          const flatWinners: any[] = [];
          if (data.prizes && Array.isArray(data.prizes)) {
              data.prizes.forEach((p: any) => {
                  if (p.winners) p.winners.forEach((w: any) => flatWinners.push({ winnerName: w.participantName, prizeName: p.name }));
                  else if (p.winnerId) flatWinners.push({ winnerName: p.winnerName, prizeName: p.name });
              });
          }
          historyData.push({
              date: new Date(data.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString(),
              raffleName: data.raffleName || 'Untitled Event',
              sessionId: doc.id,
              communityName: displayCommunity,
              winners: flatWinners,
              ts: data.createdAt?.seconds || 0,
              winnerCount: flatWinners.length
          });
      });
      historyData.sort((a,b) => b.ts - a.ts);
      setWinnerHistory(historyData);
      setLoadingHistory(false);
  }

  const handleDeleteSession = (targetId: string) => { setDeleteSessionId(targetId); }
  const confirmDeleteSession = async () => {
      if(!deleteSessionId) return;
      try {
          await deleteDoc(doc(db, 'raffle_sessions', deleteSessionId));
          setWinnerHistory(prev => prev.filter(s => s.sessionId !== deleteSessionId));
          setDeleteSessionId(null);
      } catch(e) { addToast("Error deleting session.", 'error'); }
  }

  // BULK DELETE HANDLERS
  const toggleHistorySelection = (id: string) => {
    const next = new Set(historySelection);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setHistorySelection(next);
  };

  const handleSelectAllHistory = () => {
    if (historySelection.size === winnerHistory.length) {
        setHistorySelection(new Set());
    } else {
        setHistorySelection(new Set(winnerHistory.map(s => s.sessionId)));
    }
  };

  const handleBulkDeleteRaffles = async () => {
      const batch = writeBatch(db);
      historySelection.forEach(id => {
          const ref = doc(db, 'raffle_sessions', id);
          batch.delete(ref);
      });
      try {
          await batch.commit();
          setWinnerHistory(prev => prev.filter(s => !historySelection.has(s.sessionId)));
          setHistorySelection(new Set());
          setIsSelectionMode(false);
          setShowBulkDeleteConfirm(false);
          setToastMessage("Raffles deleted successfully.");
          setShowToast(true);
      } catch (e) {
          addToast("Error during bulk delete.", 'error');
      }
  };

  const handleViewParticipants = async (sid: string) => {
      setHistorySessionId(sid);
      setLoadingParticipants(true);
      setHistoryParticipants([]);
      try {
          const snap = await getDocs(collection(db, `raffle_sessions/${sid}/participants`));
          const list = snap.docs.map(d => {
               const data = d.data() as any;
               return {
                   id: d.id, ...data, 
                   joinedAt: data.joinedAt?.seconds ? data.joinedAt.seconds * 1000 : (typeof data.joinedAt === 'number' ? data.joinedAt : Date.now())
               } as RaffleParticipant;
          });
          list.sort((a,b) => a.joinedAt - b.joinedAt);
          setHistoryParticipants(list);
      } catch(e) { addToast("Could not load participant list.", 'error'); } finally { setLoadingParticipants(false); }
  };

  const fireConfetti = () => { confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#a855f7', '#d946ef'] }); };
  
  const handleExportAll = () => { 
      const csv = "IGN,Name,Joined At,Status,Prize,Source\n" + participants.map(p => `${p.ign},${p.name},${new Date((p.joinedAt as any)?.seconds * 1000 || Date.now()).toLocaleString()},${p.isWinner ? 'WINNER' : 'Participant'},${p.wonPrize || ''},${p.isManual ? 'Manual' : 'QR'}`).join("\n");
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `raffle_full_list.csv`; a.click();
  };

  const constructJoinUrl = () => {
      let baseUrl = window.location.origin + window.location.pathname;
      if (baseUrl.endsWith('/')) { baseUrl = baseUrl.slice(0, -1); }
      return `${baseUrl}/#/raffle/join/${sessionId}`;
  };

  const handleCopyLink = () => {
      const url = constructJoinUrl();
      if (navigator.clipboard) { navigator.clipboard.writeText(url).then(() => { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }); }
  };

  const selectedPrizeWon = selectedPrizeId 
      ? (() => {
          const p = prizes.find(p => p.id === selectedPrizeId);
          if (!p) return false;
          return (p.remaining ?? 0) <= 0;
      })()
      : false;
      
  const getSelectedPrizeName = () => {
      if(!selectedPrizeId) return null;
      const p = prizes.find(p => p.id === selectedPrizeId);
      return p ? p.name : null;
  }

  const availableCodeCount = codes.filter(c => !c.isUsed && !c.isReserved).length;

  const renderVaultModal = () => (
      <AnimatePresence>
          {showSpecialVault && (
              <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
                  <MotionDiv initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-gray-900 border border-purple-500/50 p-6 w-full max-w-sm shadow-2xl">
                      <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Star className="text-purple-400" size={18}/> Special Code Vault</h3>
                          <button onClick={() => setShowSpecialVault(false)}><X className="text-gray-500"/></button>
                      </div>
                      <p className="text-xs text-gray-400 mb-4">Add codes that require a <strong>Verified Hand-off</strong>. Give them a label like "GLOBAL GO FEST TICKET".</p>
                      
                      <div className="space-y-4">
                          <div>
                              <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-1 block">Prize Label</label>
                              <input 
                                value={vaultPrizeName} 
                                onChange={(e) => setVaultPrizeName(e.target.value)} 
                                placeholder="e.g. GO Tour Ticket" 
                                className="w-full bg-gray-950 border border-gray-800 p-3 text-sm focus:border-purple-500 outline-none" 
                              />
                          </div>
                          <div>
                              <label className="text-[10px] font-black uppercase text-gray-500 ml-1 mb-1 block">Secret Codes (one per line)</label>
                              <textarea 
                                value={vaultInput} 
                                onChange={(e) => setVaultInput(e.target.value)} 
                                placeholder="PASTE_CODE_1&#10;PASTE_CODE_2" 
                                className="w-full h-32 bg-gray-950 border border-gray-800 p-3 text-sm font-mono focus:border-purple-500 outline-none resize-none" 
                              />
                          </div>
                      </div>

                      <div className="flex gap-2 mt-6">
                          <Button variant="secondary" onClick={() => setShowSpecialVault(false)} fullWidth>Cancel</Button>
                          <Button variant="purple" onClick={handleAddSpecialVaultCodes} fullWidth disabled={!vaultInput.trim() || !vaultPrizeName.trim()}>Add to Pool</Button>
                      </div>
                  </MotionDiv>
              </MotionDiv>
          )}
      </AnimatePresence>
  );

  const renderAuthModal = () => (
      <AnimatePresence>
          {showAuthModal && (
              <MotionDiv 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
              >
                  <MotionDiv 
                      initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      className="bg-gray-900 border border-gray-700 p-6 w-full max-w-sm shadow-2xl"
                  >
                      <div className="flex justify-between items-center mb-6">
                          <h3 onClick={handleSecretTap} className="text-sm font-bold text-gray-400 select-none cursor-pointer uppercase tracking-wider">Archive Login</h3>
                          <button onClick={() => setShowAuthModal(false)}><X className="text-gray-500"/></button>
                      </div>
                      <div className="space-y-4">
                          <button onClick={handleViewLocal} className="w-full bg-gray-800 hover:bg-gray-700 p-4 flex items-center gap-4 text-left transition-colors group">
                              <div className="bg-purple-500/20 p-2 rounded-full text-purple-400 group-hover:text-purple-300"><History size={24}/></div>
                              <div><div className="font-bold text-white">Device Stats</div><div className="text-xs text-gray-400">View archives for this phone</div></div>
                          </button>
                          {(adminMenuVisible || (currentUser && userRole === 'super_admin')) && (
                              <div className="animate-fade-in-up">
                                  <div className="relative my-4"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-800"></div></div><div className="relative flex justify-center"><span className="bg-gray-900 px-2 text-xs text-gray-500 uppercase">Super Access</span></div></div>
                                  <div className="bg-gray-950 p-4 border border-gray-800 space-y-3">
                                      {currentUser ? (
                                          <>
                                              <div className="text-xs text-green-400 mb-1 flex items-center gap-2"><Lock size={12}/> {currentUser.email}</div>
                                              <Button fullWidth onClick={handleAdminAuth} className="h-11 text-sm">Enter Global Archive</Button>
                                              <Button fullWidth variant="ghost" onClick={() => signOut(auth)} className="h-8 text-xs text-red-400">Sign Out</Button>
                                          </>
                                      ) : (
                                          <>
                                              <input type="email" placeholder="Email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="w-full bg-gray-900 border border-gray-700 p-3 text-sm focus:border-purple-500 outline-none" />
                                              <input type="password" placeholder="Password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full bg-gray-900 border border-gray-700 p-3 text-sm focus:border-purple-500 outline-none" />
                                              <Button fullWidth onClick={handleAdminAuth} disabled={authLoading} className="h-11 text-sm">{authLoading ? 'Verifying...' : 'Unlock Global Data'}</Button>
                                          </>
                                      )}
                                  </div>
                              </div>
                          )}
                      </div>
                  </MotionDiv>
              </MotionDiv>
          )}
      </AnimatePresence>
  );

  const renderResultsModal = () => (
      <AnimatePresence>
          {showResultsModal && (
              <MotionDiv 
                  initial={{ opacity: 0, y: '100%' }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: '100%' }}
                  className="fixed inset-0 z-[60] bg-gray-950 flex flex-col h-screen"
              >
                  <ConfirmationModal isOpen={showBulkDeleteConfirm} onClose={() => setShowBulkDeleteConfirm(false)} onConfirm={handleBulkDeleteRaffles} title={`Delete ${historySelection.size} Raffles?`} message="This action cannot be undone and will remove these events from history forever." confirmText="Delete Selected" isDanger={true} />
                  
                  {historySessionId && (
                      <div className="absolute inset-0 z-[70] bg-gray-950 flex flex-col">
                          <div className="p-4 border-b border-gray-800 bg-gray-900 flex items-center gap-4">
                              <button onClick={() => setHistorySessionId(null)} className="p-2 rounded-full border border-gray-800 bg-gray-800 text-gray-400 hover:text-white"><ArrowLeft size={20}/></button>
                              <div className="flex-1">
                                  <h3 className="font-bold text-lg">Attendee Log</h3>
                                  <p className="text-xs text-gray-500">View all registered trainers</p>
                              </div>
                              <button onClick={() => handleViewParticipants(historySessionId!)} className="p-2 text-purple-400 hover:text-purple-300"><RefreshCw size={20} className={loadingParticipants ? 'animate-spin' : ''}/></button>
                          </div>
                          <div className="flex-1 overflow-y-auto p-4 space-y-2">
                              {loadingParticipants ? (
                                  <div className="text-center text-gray-500 mt-20 animate-pulse">Loading participants...</div>
                              ) : historyParticipants.length === 0 ? (
                                  <div className="text-center text-gray-500 mt-20">No attendees found.</div>
                              ) : (
                                  historyParticipants.map(p => (
                                      <div key={p.id} className="bg-gray-900 border border-gray-800 p-3 flex justify-between items-center">
                                          <div className="flex items-center gap-3">
                                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${p.isWinner ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-800 text-gray-600'}`}>
                                                  {p.isWinner ? <Trophy size={14}/> : <Users size={14}/>}
                                              </div>
                                              <div>
                                                  <div className={`font-bold text-sm ${p.isWinner ? 'text-white' : 'text-gray-400'}`}>{p.ign}</div>
                                                  <div className="text-[10px] text-gray-500">{p.name} • {new Date(p.joinedAt).toLocaleTimeString()}</div>
                                              </div>
                                          </div>
                                          {p.isWinner && (
                                              <div className="text-right">
                                                  <div className="text-[10px] font-black uppercase text-purple-500">{p.wonPrize}</div>
                                              </div>
                                          )}
                                      </div>
                                  ))
                              )}
                          </div>
                      </div>
                  )}

                  <div className="p-4 border-b border-gray-800 bg-gray-900 flex items-center justify-between sticky top-0 z-50">
                      <div className="flex items-center gap-4">
                          <button onClick={() => setShowResultsModal(false)} className="p-2 rounded-full border border-gray-800 text-gray-400 hover:text-white"><X size={20}/></button>
                          <div><h2 className="text-xl font-bold">Winner Archives</h2><p className="text-xs text-gray-500">{isGlobalHistory ? 'Global Events' : 'My Local History'}</p></div>
                      </div>
                      <div className="flex items-center gap-2">
                          <button 
                            onClick={() => { setIsSelectionMode(!isSelectionMode); setHistorySelection(new Set()); }}
                            className={`text-xs font-bold px-3 py-2  transition-colors ${isSelectionMode ? 'bg-purple-600 text-white' : 'text-purple-400 hover:bg-purple-500/10'}`}
                          >
                              {isSelectionMode ? 'Done' : 'Manage'}
                          </button>
                          {!isSelectionMode && (
                              <button onClick={() => fetchHistory(isGlobalHistory)} className="p-2 text-purple-400"><RefreshCw size={20} className={loadingHistory ? 'animate-spin' : ''}/></button>
                          )}
                      </div>
                  </div>

                  {isSelectionMode && winnerHistory.length > 0 && (
                      <div className="p-4 bg-gray-900/80 backdrop-blur-md border-b border-gray-800 flex justify-between items-center animate-fade-in">
                          <button onClick={handleSelectAllHistory} className="text-xs font-bold text-gray-400 flex items-center gap-2">
                              {historySelection.size === winnerHistory.length ? <CheckSquare size={16} className="text-purple-500"/> : <Square size={16}/>}
                              Select All
                          </button>
                          <Button 
                            variant="danger" 
                            className="h-8 text-xs px-3" 
                            disabled={historySelection.size === 0}
                            onClick={() => setShowBulkDeleteConfirm(true)}
                          >
                              Delete Selected ({historySelection.size})
                          </Button>
                      </div>
                  )}

                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {loadingHistory ? (
                          <div className="text-center text-gray-500 mt-20 animate-pulse">Fetching history...</div>
                      ) : winnerHistory.length === 0 ? (
                          <div className="text-center text-gray-500 mt-20">No raffle history found.</div>
                      ) : (
                          winnerHistory.map(session => (
                              <div 
                                key={session.sessionId} 
                                className={`bg-gray-900 border  overflow-hidden shadow-lg group transition-all ${isSelectionMode ? 'cursor-pointer hover:border-purple-500/50' : ''} ${historySelection.has(session.sessionId) ? 'border-purple-500 ring-1 ring-purple-500 bg-purple-900/10' : 'border-gray-800'}`}
                                onClick={() => isSelectionMode && toggleHistorySelection(session.sessionId)}
                              >
                                  <div className="p-4 border-b border-gray-800 bg-gray-950/50 flex justify-between items-start">
                                      <div className="flex gap-3">
                                          {isSelectionMode && (
                                              <div className="mt-1">
                                                  {historySelection.has(session.sessionId) ? <CheckSquare size={20} className="text-purple-500"/> : <Square size={20} className="text-gray-600"/>}
                                              </div>
                                          )}
                                          <div>
                                              <div className="text-[10px] text-purple-500 font-black uppercase tracking-[0.2em] mb-1">{session.date}</div>
                                              <h3 className="font-bold text-white text-lg leading-none">{session.raffleName}</h3>
                                              <div className="text-[10px] text-gray-500 mt-1 uppercase font-bold tracking-wider">{session.communityName}</div>
                                          </div>
                                      </div>
                                      {!isSelectionMode && (
                                          <div className="flex gap-1">
                                              <button onClick={(e) => { e.stopPropagation(); handleViewParticipants(session.sessionId); }} className="p-2 text-gray-500 hover:text-white" title="Attendees"><Users size={16}/></button>
                                              <button onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.sessionId); }} className="p-2 text-gray-500 hover:text-red-400" title="Delete"><Trash2 size={16}/></button>
                                          </div>
                                      )}
                                  </div>
                                  <div className="p-4 space-y-2">
                                      {session.winners.length === 0 ? (
                                          <div className="text-[10px] text-gray-600 italic">No winners recorded (Test Session)</div>
                                      ) : (
                                          session.winners.map((w: any, idx: number) => (
                                              <div key={idx} className="flex justify-between items-center text-sm">
                                                  <div className="flex items-center gap-2"><Trophy size={10} className="text-yellow-500"/><span className="text-gray-300">{w.winnerName}</span></div>
                                                  <div className="text-[10px] text-gray-600 font-bold uppercase">{w.prizeName}</div>
                                              </div>
                                          ))
                                      )}
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </MotionDiv>
          )}
      </AnimatePresence>
  );

  if (viewState === 'SETTINGS') {
      return (
        <div className="flex flex-col h-full bg-gray-950 text-white">
            {renderAuthModal()}
            {renderResultsModal()}
            <ConfirmationModal isOpen={!!deleteSessionId} onClose={() => setDeleteSessionId(null)} onConfirm={confirmDeleteSession} title="Delete History Entry?" message="This will remove the event from your history permanently." confirmText="Delete Forever" isDanger={true} />
            <div className="p-4 border-b border-gray-800 flex items-center gap-4 bg-gray-900 sticky top-0 z-30">
                <button onClick={() => setViewState('GAME')} className="p-2 bg-gray-800 rounded-full border border-gray-700 text-gray-400 hover:text-white"><ArrowLeft size={20}/></button>
                <div><h2 className="text-xl font-bold">Raffle Settings</h2><p className="text-xs text-gray-500">Configure prizes & options</p></div>
            </div>
            <div className="p-6 space-y-6 overflow-y-auto pb-20">
                <div>
                    <h3 className="text-sm text-gray-400 font-bold uppercase mb-2">Quick-Add Prizes</h3>
                    <div className="flex gap-2 mb-4"><input type="text" value={newPresetInput} onChange={(e) => setNewPresetInput(e.target.value)} placeholder="New preset name..." className="flex-1 bg-gray-900 border border-gray-800 p-2 text-sm focus:border-purple-500 outline-none" /><Button variant="secondary" onClick={handleAddPreset} className="py-2 h-auto"><Plus size={18}/></Button></div>
                    <div className="flex flex-wrap gap-2">{presetPrizes.map((prize, idx) => (<div key={idx} className="bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-full text-sm flex items-center gap-2">{prize}<button onClick={() => setPresetPrizes(presetPrizes.filter((_, i) => i !== idx))} className="text-gray-500 hover:text-red-400"><X size={14}/></button></div>))}</div>
                </div>
                <div className="border-t border-gray-800 pt-6">
                    <button onClick={handleOpenAuthModal} className="w-full flex items-center justify-between p-4 bg-gray-900 border border-gray-800 hover:border-purple-600/50 transition-colors group">
                        <div className="flex items-center gap-3"><div className="p-2 bg-purple-900/20 text-purple-400 group-hover:text-purple-300"><History size={20} /></div><div className="text-left"><span className="font-bold text-white block">Winner Archives</span><span className="text-xs text-gray-500">View past winners from previous events</span></div></div><ChevronRight size={16} className="text-gray-600 group-hover:text-white" />
                    </button>
                </div>
            </div>
        </div>
      )
  }

  if (!sessionId) {
      return (
        <div className="min-h-screen bg-gray-950 text-white flex flex-col">
            {renderAuthModal()}
            {renderResultsModal()}
            <ConfirmationModal isOpen={!!deleteSessionId} onClose={() => setDeleteSessionId(null)} onConfirm={confirmDeleteSession} title="Delete History Entry?" message="This will remove the event from your history permanently." confirmText="Delete Forever" isDanger={true} />
            <div className="p-4 border-b border-gray-800 flex items-center gap-4 bg-gray-900 sticky top-0 z-30">
                <button onClick={() => navigate('/')} className="p-2 bg-gray-800 rounded-full border border-gray-700 text-gray-400 hover:text-white"><ArrowLeft size={20}/></button>
                <div className="flex-1">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-purple-400"><Trophy size={20}/> Raffle Master</h2>
                    <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-500">Live Giveaways</p>
                        {currentUser && (
                            <span className="flex items-center gap-1 text-[10px] bg-green-900/30 text-green-400 px-2 py-0.5 border border-green-900/50 font-bold">
                                <Cloud size={10} /> Cloud Sync Active
                            </span>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
                <div className="w-24 h-24 bg-purple-900/20 rounded-full flex items-center justify-center border-2 border-purple-500/50"><QrCode size={48} className="text-purple-400" /></div>
                <h3 className="text-2xl font-bold">Start New Event</h3>
                <div className="w-full max-w-xs space-y-3"><input type="text" placeholder="Event Name (e.g. CD meetup)" value={newRaffleName} onChange={(e) => setNewRaffleName(e.target.value)} className="w-full bg-gray-900 border border-gray-800 p-3 text-center focus:border-purple-500 outline-none transition-all" /><Button variant="purple" onClick={createSession} icon={<PlayCircle />} fullWidth disabled={!newRaffleName.trim()}>Start Session</Button></div>
                <button onClick={() => setViewState('SETTINGS')} className="text-xs text-gray-500 hover:text-white flex items-center gap-1 mt-4"><Settings size={12}/> Raffle Settings & History</button>
            </div>
        </div>
      );
  }

  const renderProgressBar = () => (
      <div className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800 shrink-0">
          {[{ label: '1. Prizes', icon: Gift }, { label: '2. Entries', icon: Users }, { label: '3. Draw', icon: Trophy }].map((step, idx) => (
              <div key={idx} onClick={() => setSessionStep(idx)} className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${sessionStep === idx ? 'text-purple-400' : 'text-gray-600 hover:text-gray-400'}`}>
                  <div className={`p-2 rounded-full ${sessionStep === idx ? 'bg-purple-900/30' : ''}`}><step.icon size={20} className={sessionStep === idx ? 'fill-current' : ''} /></div><span className="text-[10px] font-bold uppercase tracking-wider">{step.label}</span>
              </div>
          ))}
      </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col h-screen overflow-hidden">
        <ConfirmationModal isOpen={showEndSessionModal} onClose={() => setShowEndSessionModal(false)} onConfirm={confirmEndSession} title="End Raffle?" message="Are you sure? This will end the raffle and disconnect all users." confirmText="Yes, End Raffle" isDanger={true} />
        <ConfirmationModal isOpen={!!participantToKick} onClose={() => setParticipantToKick(null)} onConfirm={confirmKickParticipant} title="Remove User?" message="Remove this participant from the raffle?" confirmText="Remove" isDanger={true} />
        <ConfirmationModal isOpen={!!massDrawConfirm} onClose={() => setMassDrawConfirm(null)} onConfirm={confirmMassDraw} title="Mass Draw" message={`Are you sure you want to draw ${massDrawConfirm?.count} winners for ${massDrawConfirm?.prizeName}?`} confirmText="Draw Winners" isDanger={false} />
        {renderVaultModal()}
        {renderAuthModal()}
        {renderResultsModal()}

        <AnimatePresence>
            {showQrModal && (
                <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6" onClick={() => setShowQrModal(false)}>
                    <button onClick={() => setShowQrModal(false)} className="absolute top-6 right-6 p-2 bg-gray-800 rounded-full text-white"><X size={32} /></button>
                    <div className="bg-white p-6" onClick={e => e.stopPropagation()}><QRCodeSVG value={constructJoinUrl()} size={window.innerWidth > 400 ? 350 : 250} /></div>
                    <h2 className="text-white text-2xl font-bold mt-8">Scan to Join</h2>
                    <div className="mt-8"><button onClick={handleCopyLink} className={`px-6 py-3 rounded-full text-sm font-bold flex items-center gap-2 transition-colors ${linkCopied ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>{linkCopied ? <Check size={16} /> : <LinkIcon size={16}/>} {linkCopied ? 'Link Copied!' : 'Copy Link'}</button></div>
                </MotionDiv>
            )}
        </AnimatePresence>

        <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900 sticky top-0 z-30 shrink-0">
            <div className="flex items-center gap-4"><button onClick={() => navigate('/')} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white border border-gray-700"><ArrowLeft size={20}/></button><div className="flex flex-col select-none"><h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">{raffleName || 'Raffle Master'}</h2><span className="text-[10px] text-gray-500 font-mono">ID: {sessionId.slice(0,6)}</span></div></div>
            <div className="flex gap-2"><button onClick={() => setViewState('SETTINGS')} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white border border-gray-700"><Settings size={20} /></button><Button variant="danger" onClick={handleEndSessionClick} className="h-9 text-xs px-3">End</Button></div>
        </div>
        {renderProgressBar()}

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 pb-24">
            {sessionStep === 0 && (
                <div className="max-w-md mx-auto space-y-6">
                    <div className="text-center mb-6"><h2 className="text-2xl font-bold text-white mb-2">The Loot Locker</h2><p className="text-sm text-gray-400">Add everything you plan to give away today.</p></div>
                    <div className="bg-gray-900 p-4 border border-gray-800 space-y-4">
                        <div className="flex gap-2">
                            <input type="text" value={prizeInput} onChange={(e) => setPrizeInput(e.target.value)} placeholder="Prize Name" className="flex-1 bg-gray-950 border border-gray-800 px-3 py-3 text-sm focus:border-purple-500 outline-none" onKeyDown={(e) => e.key === 'Enter' && addPrize()} />
                            <button onClick={() => setAllowOptOut(!allowOptOut)} title="Allow Opt-Out" className={`p-3  border ${allowOptOut ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-gray-950 border-gray-800 text-gray-600'}`}><Ban size={18} className={allowOptOut ? 'fill-current' : ''} /></button>
                            <button onClick={() => setIsGrandPrize(!isGrandPrize)} title="Toggle Grand Prize" className={`p-3  border ${isGrandPrize ? 'bg-yellow-500/20 border-yellow-500 text-yellow-500' : 'bg-gray-950 border-gray-800 text-gray-600'}`}><Crown size={18} className={isGrandPrize ? 'fill-current' : ''} /></button>
                            <Button variant="secondary" onClick={addPrize} className="px-4"><Plus size={18}/></Button>
                        </div>
                        <div className="bg-gray-950/50 p-2 border border-gray-800/50">
                            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 px-1">
                                <button 
                                    onClick={addDigitalPrizeQuickly} 
                                    disabled={availableCodeCount < 1 || !!linkedDistributorId} 
                                    className={`px-4 py-2 text-[10px] font-black  border transition-all flex items-center gap-1.5 uppercase tracking-wider whitespace-nowrap ${linkedDistributorId ? 'bg-gray-800 border-gray-700 text-gray-500 opacity-50 cursor-not-allowed' : availableCodeCount > 0 ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 text-gray-500'}`}
                                    title={linkedDistributorId ? "Disabled: Raffle is linked to a Distribution Session" : "Add Digital Prize"}
                                >
                                    <Zap size={12} fill={(!linkedDistributorId && availableCodeCount > 0) ? "currentColor" : "none"}/> 
                                    {linkedDistributorId ? 'Digital Disabled' : `Digital Promo (${availableCodeCount})`}
                                </button>
                                <button onClick={() => setShowSpecialVault(true)} className={`px-4 py-2 text-[10px] font-black  border transition-all flex items-center gap-1.5 uppercase tracking-wider whitespace-nowrap bg-purple-900 border-purple-700 text-purple-200`}><Star size={12} fill="currentColor"/> Special Codes</button>
                                {presetPrizes.map((p, i) => ( <button key={i} onClick={() => addPresetPrize(p)} className="px-4 py-2 bg-gray-800 text-[10px] font-black text-gray-300 border border-gray-700 flex items-center gap-1.5 uppercase tracking-wider whitespace-nowrap"><Plus size={12}/> {p}</button> ))}
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {prizes.length === 0 && <div className="text-center text-gray-600 py-8 italic text-sm">Locker is empty. Add prizes above.</div>}
                        {prizes.map((prize) => (
                            <div key={prize.id} className="bg-gray-900 border border-gray-800 p-3 flex justify-between items-center group">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => toggleGrandPrize(prize.id)} className={`w-8 h-8 rounded-full flex items-center justify-center ${prize.isGrandPrize ? 'bg-yellow-500/20 text-yellow-500' : prize.isSpecial ? 'bg-purple-500/20 text-purple-400' : prize.isDigitalCode ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-800'}`}>{prize.isGrandPrize ? <Crown size={14} className="fill-current"/> : prize.isSpecial ? <Star size={14} className="fill-current"/> : prize.isDigitalCode ? <Zap size={14} className="fill-current"/> : <Gift size={14}/>}</button>
                                    <div className="flex flex-col"><span className={prize.remaining === 0 ? 'text-gray-500 line-through' : 'text-white font-bold text-sm'}>{prize.name} {prize.isSpecial && <span className="ml-2 text-[8px] bg-purple-900 text-purple-300 px-1 uppercase tracking-tighter">Verified</span>} {prize.allowOptOut && <span className="ml-1 text-[8px] bg-red-900/50 text-red-300 px-1 uppercase tracking-tighter">Prize can be opt-out</span>}</span><div className="text-[10px] text-gray-500">Stock: <span className="text-white font-mono">{prize.remaining}</span> / {prize.quantity}</div></div>
                                </div>
                                <div className="flex items-center gap-2"><div className="flex items-center bg-gray-800"><button onClick={() => updatePrizeQuantity(prize.id, -1)} disabled={prize.isSpecial} className="p-2 disabled:opacity-20 text-gray-500"><Minus size={12}/></button><span className="text-xs w-4 text-center font-mono">{prize.quantity}</span><button onClick={() => updatePrizeQuantity(prize.id, 1)} disabled={prize.isSpecial || (prize.isDigitalCode && availableCodeCount < 1)} className="p-2 disabled:opacity-20 text-gray-500"><Plus size={12}/></button></div><button onClick={() => removePrize(prize.id)} className="text-gray-600 hover:text-red-400 p-2"><Trash2 size={16}/></button></div>
                            </div>
                        ))}
                    </div>
                    {prizes.length > 0 && (<Button fullWidth onClick={() => setSessionStep(1)} className="mt-8 bg-gradient-to-r from-purple-600 to-blue-600 border-none h-14">Next: Gather Entries <ChevronRight size={16}/></Button>)}
                </div>
            )}
            {sessionStep === 1 && (
                <div className="max-w-lg mx-auto flex flex-col gap-6">
                    <div className="bg-white p-6 flex flex-col items-center justify-center text-center shadow-xl w-full">
                        <QRCodeSVG value={constructJoinUrl()} size={200} /><h3 className="text-black font-bold text-2xl mt-4">Scan to Join</h3><p className="text-gray-500 text-sm mt-1 mb-4">Users can join from their phones.</p>
                        <div className="flex gap-2"><button onClick={() => setShowQrModal(true)} className="px-4 py-2 bg-gray-100 rounded-full text-xs font-bold text-gray-700 flex items-center gap-2 hover:bg-gray-200 transition-colors"><Maximize2 size={14}/> Fullscreen</button><button onClick={handleCopyLink} className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-colors ${linkCopied ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>{linkCopied ? <Check size={14} /> : <LinkIcon size={14}/>} {linkCopied ? 'Copied!' : 'Copy Link'}</button></div>
                    </div>
                    <div className="flex-1 flex flex-col bg-gray-900 border border-gray-800 overflow-hidden"><div className="p-4 border-b border-gray-800"><h3 className="font-bold flex items-center gap-2"><ClipboardList className="text-purple-400"/> Manual Entry</h3><div className="flex gap-2"><textarea value={manualInput} onChange={(e) => setManualInput(e.target.value)} placeholder="Ash Ketchum..." className="flex-1 bg-gray-950 border border-gray-800 p-2 text-sm h-20 resize-none outline-none" /><Button variant="secondary" onClick={addManualEntries} className="h-auto">Add</Button></div></div>
                        <div className="flex-1 p-4"><div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-gray-400 uppercase">Total Entries ({participants.length})</span><button onClick={handleExportAll} className="text-xs text-purple-400 hover:text-white flex items-center gap-1"><Download size={12}/> CSV</button></div>
                            <div className="space-y-1">{participants.length === 0 && <div className="text-center text-gray-700 text-xs py-10 italic">Waiting for entries...</div>}{participants.map(p => (<div key={p.id} className="text-sm p-2 bg-gray-950 flex justify-between items-center"><div className="flex items-center gap-2">{p.isManual ? <ClipboardList size={12} className="text-gray-500"/> : <Users size={12} className="text-blue-500"/>}<span className={p.isWinner ? 'text-gray-500 line-through' : 'text-white'}>{p.ign}</span></div><button onClick={() => setParticipantToKick(p.id)} className="text-gray-700 hover:text-red-500"><X size={12}/></button></div>))}</div>
                        </div>
                        <div className="p-4 border-t border-gray-800"><Button fullWidth onClick={() => setSessionStep(2)} disabled={participants.length === 0} className="bg-gradient-to-r from-purple-600 to-blue-600 border-none h-14">Ready to Draw <ChevronRight size={16}/></Button></div>
                    </div>
                </div>
            )}
            {sessionStep === 2 && (
                <div className="max-w-lg mx-auto">
                    <div className="mb-6 flex gap-2 overflow-x-auto pb-4 no-scrollbar">
                        {prizes.sort((a,b) => (a.isSpecial ? 1 : 0) - (b.isSpecial ? 1 : 0)).filter(p => (p.remaining ?? 0) > 0).map(p => (
                            <button key={p.id} onClick={() => handleSelectPrize(p)} className={`shrink-0 px-4 py-3  border flex flex-col items-start gap-1 transition-all min-w-[100px] ${selectedPrizeId === p.id ? 'bg-purple-600 border-purple-500 text-white scale-105 shadow-lg shadow-purple-500/20' : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200'}`}><div className="flex items-center gap-2 w-full justify-between">{p.isGrandPrize ? <Crown size={14} className={selectedPrizeId === p.id ? "text-yellow-300 fill-current" : "text-yellow-600"} /> : p.isSpecial ? <Star size={14} className={selectedPrizeId === p.id ? "text-purple-300 fill-current" : "text-purple-500"} /> : p.isDigitalCode ? <Zap size={14} className={selectedPrizeId === p.id ? "text-blue-300 fill-current" : "text-blue-600"} /> : null}<span className="text-[10px] bg-black/20 px-1.5">{(p.remaining ?? 0)} left</span></div><span className="font-bold text-sm truncate w-full text-left">{p.name}</span></button>
                        ))}
                    </div>

                    <div className="bg-gradient-to-br from-purple-900/40 to-gray-900 border border-purple-500/30 p-8 mb-6 flex flex-col items-center justify-center min-h-[250px] relative overflow-hidden shadow-2xl">
                        {winner ? (
                            <MotionDiv key={winner} initial={{ scale: 0.8, opacity: 0.5 }} animate={{ scale: 1.2, opacity: 1 }} className="text-center z-10 w-full">
                                <div className="text-xs text-purple-300 uppercase tracking-widest font-bold mb-2">{isRolling ? 'Rolling...' : 'Winner Declared!'}</div>
                                {prizes.find(p => p.id === selectedPrizeId)?.isSpecial && !isRolling && (
                                    <div className="bg-yellow-500 text-black text-[10px] font-black uppercase px-2 py-0.5 rounded-full inline-block mb-3 animate-bounce">Verify Hand-off</div>
                                )}
                                <div className={`font-black text-4xl break-all leading-tight ${isRolling ? 'text-gray-400 blur-[1px]' : 'text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400'}`}>{winner}</div>
                                {winnerDetail && !isRolling && (<><div className="text-sm text-gray-400 mt-2 font-bold">{winnerDetail}</div><div className="mt-4 pt-4 border-t border-white/10 w-full text-sm text-gray-300">Won: <span className="text-white font-bold text-lg">{getSelectedPrizeName()}</span></div></>)}
                            </MotionDiv>
                        ) : (<div className="text-gray-600 flex flex-col items-center"><Sparkles size={48} className="mb-2 opacity-50" /><span className="text-sm font-bold">Select a Prize to Draw</span>
                        {!selectedPrizeId && <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 p-3 text-yellow-500 text-xs font-bold animate-pulse flex items-center gap-2"><AlertTriangle size={14}/> Please select a prize first!</div>}
                        </div>)}
                    </div>
                    <div className="flex gap-2 mb-8">
                        <Button fullWidth onClick={pickWinner} disabled={isRolling || !selectedPrizeId || selectedPrizeWon} className="h-16 text-lg bg-purple-600 shadow-purple-900/20 flex-1" icon={isRolling ? <RefreshCw className="animate-spin"/> : <Shuffle />}>{selectedPrizeWon ? 'Fully Awarded' : (isRolling ? 'Spinning...' : 'Draw Winner')}</Button>
                        {selectedPrizeId && prizes.find(p => p.id === selectedPrizeId && (p.remaining||0) >= 5) && (
                            <Button variant="secondary" onClick={() => handleMassDrawClick(5)} disabled={isRolling || selectedPrizeWon} className="w-24 font-bold h-16 flex flex-col items-center justify-center leading-tight"><span className="text-xs uppercase">Draw</span><span className="text-xl">x5</span></Button>
                        )}
                        {selectedPrizeId && prizes.find(p => p.id === selectedPrizeId && (p.remaining||0) >= 10) && (
                            <Button variant="secondary" onClick={() => handleMassDrawClick(10)} disabled={isRolling || selectedPrizeWon} className="w-24 font-bold h-16 flex flex-col items-center justify-center leading-tight"><span className="text-xs uppercase">Draw</span><span className="text-xl">x10</span></Button>
                        )}
                    </div>
                    
                    <div className="border-t border-gray-800 pt-6"><h3 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><Trophy size={12}/> Winners Log</h3>
                        <div className="space-y-2">{(() => { 
                            const allWins: any[] = []; 
                            prizes.forEach(p => { 
                                if(p.winners) p.winners.forEach(w => allWins.push({ ...w, prizeObj: p })); 
                            }); 
                            return allWins.sort((a,b) => b.awardedAt - a.awardedAt).map((w, i) => {
                                const p = w.prizeObj;
                                const participant = participants.find(part => part.id === w.participantId);
                                return (
                                    <div key={i} className={`p-3  border flex justify-between items-center ${p.isGrandPrize ? 'bg-yellow-900/10 border-yellow-600/30' : 'bg-gray-900 border-gray-800'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${p.isGrandPrize ? 'bg-yellow-500/20 text-yellow-500' : p.isSpecial ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-800 text-gray-500'}`}>{p.isGrandPrize ? <Crown size={14} className="fill-current"/> : p.isSpecial ? <Star size={14} className="fill-current"/> : <CheckCircle size={14} />}</div>
                                            <div>
                                                <div className={`text-sm font-bold ${p.isGrandPrize ? 'text-yellow-200' : 'text-white'}`}>{w.participantName}</div>
                                                <div className="text-xs text-gray-500">{p.name}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {p.isSpecial && !participant?.isReleased && (
                                                <Button variant="niantic" onClick={() => handleReleaseCode(w.participantId, p)} className="h-8 text-[10px] px-2 uppercase font-black">Release Code</Button>
                                            )}
                                            {p.isSpecial && participant?.isReleased && (
                                                <div className="text-[10px] text-green-500 font-bold flex items-center gap-1"><Check size={12}/> Released</div>
                                            )}
                                            <div className="text-right"><span className="text-[10px] text-gray-600 block">{new Date(w.awardedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div>
                                        </div>
                                    </div>
                                );
                            }); 
                        })()}</div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};
