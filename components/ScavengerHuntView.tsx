
import React, { useEffect, useState } from 'react';
import { ArrowLeft, Map, Plus, Trash2, Edit2, Save, X, Navigation, LocateFixed, Eye, EyeOff, Lock, ChevronRight, GripVertical, QrCode, Share2, Copy, AlertTriangle, Users, Shuffle, ListOrdered, Search, User, Link as LinkIcon, Check, Play, CheckCircle, ClipboardList } from 'lucide-react';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import { Button } from './Button';
import { auth, db } from '../firebase';
// @ts-ignore
import { onAuthStateChanged } from 'firebase/auth';
// @ts-ignore
import { doc, getDoc, getDocs, where, collection, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, query, orderBy, setDoc, deleteField } from 'firebase/firestore';
import { ScavengerHunt, ScavengerParticipant, AppSettings, ScavengerTarget, ScavengerLayer, ScavengerTask } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { QRCodeSVG } from 'qrcode.react';
import { ConfirmationModal } from './ConfirmationModal';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from './ToastContext';
import { useDiscordAuth } from './useDiscordAuth';

// Fix for framer-motion type mismatch
const MotionDiv = motion.div as any;

interface ScavengerHuntViewProps {
    settings: AppSettings;
}

export const ScavengerHuntView: React.FC<ScavengerHuntViewProps> = ({ settings }) => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user: discordUser } = useDiscordAuth();
  
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [userRole, setUserRole] = useState<'super_admin' | 'admin' | 'host' | 'user'>('user');
  const [myDeviceId, setMyDeviceId] = useState<string>('');

  useEffect(() => {
      let id = localStorage.getItem('pogo_device_id');
      if (!id || id === 'host' || id === 'unknown') {
          id = uuidv4();
          localStorage.setItem('pogo_device_id', id);
      }
      setMyDeviceId(id);
  }, []);

  useEffect(() => {
      const unsub = onAuthStateChanged(auth, async (user: any) => {
          setCurrentUser(user);
          if (user) {
              try {
                  const snap = await getDoc(doc(db, 'users', user.uid));
                  if (snap.exists()) {
                      const data = snap.data() as any;
                      let r = (data.role || 'user').toLowerCase();
                      if (user.email === 'elmersdesign@gmail.com') r = 'super_admin';
                      setUserRole(r as any);
                  }
              } catch (e) { console.error("Error fetching role", e); }
          } else {
              // Fallback: check session storage for Discord host role if no Firebase user
              const storedRole = sessionStorage.getItem('discord_role');
              if (storedRole === 'host') setUserRole('host');
              else setUserRole('user');
          }
      });
      return () => unsub();
  }, []);

  // Builder State
  const [viewState, setViewState] = useState<'LIST' | 'EDIT_HUNT' | 'MONITOR'>('LIST');
  const [hunts, setHunts] = useState<ScavengerHunt[]>([]);
  const [currentHunt, setCurrentHunt] = useState<ScavengerHunt | null>(null);
  
  // Player Monitoring State
  const [participants, setParticipants] = useState<ScavengerParticipant[]>([]);

  // Form State
  const [huntTitle, setHuntTitle] = useState('');
  const [huntDesc, setHuntDesc] = useState('');
  const [huntMode, setHuntMode] = useState<'sequential' | 'free_roam'>('sequential');
  const [tasks, setTasks] = useState<ScavengerTask[]>([]);
  
  // Pokemon Pool & Layers
  const [pokemonPoolText, setPokemonPoolText] = useState('');
  const [layers, setLayers] = useState<ScavengerLayer[]>([{ id: uuidv4(), name: 'Layer 1', drawRequirement: 5, targets: [] }]);
  const [quickAddInputs, setQuickAddInputs] = useState<{[key: number]: string}>({});
  const [isFetchingPokemon, setIsFetchingPokemon] = useState(false);

  // UI State
  const [linkCopied, setLinkCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [participantToKick, setParticipantToKick] = useState<string | null>(null);

  // Verification
  const [verificationParticipant, setVerificationParticipant] = useState<ScavengerParticipant | null>(null);
  const [verificationHuntId, setVerificationHuntId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // 1. Fetch Hunts
  useEffect(() => {
      if (!currentUser && userRole !== 'super_admin' && userRole !== 'host' && !myDeviceId) return;

      const q = query(collection(db, 'scavenger_hunts'), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(q, (snap: any) => {
          const list = snap.docs.map((d: any) => ({ ...d.data() } as any))
              .filter((hunt: any) => {
                  // Padlock: Check Cloud UID, Discord UID, OR Local Device Fallback
                  return (currentUser && hunt.hostUid === currentUser.uid) || 
                         (discordUser && hunt.discordUid === discordUser.id) || 
                         (hunt.hostDevice === myDeviceId);
              });
          setHunts(list);
      });
      return () => unsub();
  }, [currentUser, userRole, myDeviceId, discordUser]);

  // 2. Fetch Participants (If Monitoring)
  useEffect(() => {
      if (viewState === 'MONITOR' && currentHunt) {
          const unsub = onSnapshot(collection(db, `scavenger_hunts/${currentHunt.id}/participants`), (snap: any) => {
              const list = snap.docs.map((d: any) => ({ ...d.data() } as ScavengerParticipant));
              // Sort by verified status
              list.sort((a: ScavengerParticipant, b: ScavengerParticipant) => (a.isVerified === b.isVerified) ? 0 : a.isVerified ? -1 : 1);
              setParticipants(list);
          });
          return () => unsub();
      }
  }, [viewState, currentHunt]);

  // 3. Check for Scanner URL ?hunt=X&verify=Y
  useEffect(() => {
      const hash = window.location.hash;
      const hashParts = hash.split('?');
      if (hashParts.length > 1 && currentUser) {
          const hashParams = new URLSearchParams(hashParts[1]);
          const hId = hashParams.get('hunt');
          const vId = hashParams.get('verify');
          
          if (hId && vId) {
              const checkVerification = async () => {
                  try {
                      const huntSnap = await getDoc(doc(db, `scavenger_hunts/${hId}`));
                      if (!huntSnap.exists()) {
                          addToast("Hunt not found.", 'error');
                          return;
                      }
                      
                      const huntData = huntSnap.data() as any;
                      
                      // SECURITY CHECK: Does this belong to the logged-in Ambassador or their device?
                      const isOwner = (huntData.hostUid && currentUser && huntData.hostUid === currentUser.uid) ||
                                      (huntData.discordUid && discordUser && huntData.discordUid === discordUser.id) ||
                                      (huntData.hostDevice === myDeviceId);

                      if (!isOwner) {
                          addToast("Unauthorized: This hunt belongs to another Ambassador.", 'error');
                          const currentUrl = window.location.href;
                          const [baseUrl] = currentUrl.split('?');
                          window.history.replaceState({}, document.title, baseUrl);
                          return;
                      }

                      const docRef = doc(db, `scavenger_hunts/${hId}/participants`, vId);
                      const snap = await getDoc(docRef);
                      if (snap.exists()) {
                          setVerificationParticipant({ id: snap.id, ...snap.data() } as ScavengerParticipant);
                          setVerificationHuntId(hId);
                      } else {
                         addToast("Participant not found.", 'error');
                      }
                  } catch (e) {
                     addToast("Error fetching participant.", 'error');
                  }
              };
              checkVerification();
          }
      }
  }, [currentUser, addToast, discordUser, myDeviceId]);

  // --- ACTIONS ---

  const handleVerifyComplete = async () => {
      if (!verificationParticipant || !verificationHuntId) return;
      setVerifying(true);
      let updateData: any = { isVerified: true, verifiedAt: Date.now() };
      try {
          const raffleQ = query(collection(db, 'raffle_sessions'), where('active', '==', true));
          const raffleSnap = await getDocs(raffleQ);
          if (!raffleSnap.empty) {
              const activeRaffle = raffleSnap.docs.find(d => {
                  const rData = d.data();
                  return (currentUser && rData.hostUid === currentUser.uid) || 
                         (discordUser && rData.discordUid === discordUser.id) || 
                         (rData.hostDevice === myDeviceId);
              });
              if (activeRaffle) {
                  updateData.raffleId = activeRaffle.id; // Attach to player
                  await setDoc(doc(db, `raffle_sessions/${activeRaffle.id}/participants`, verificationParticipant.id), {
                      id: verificationParticipant.id, deviceId: verificationParticipant.deviceId, name: verificationParticipant.name || 'Trainer', ign: verificationParticipant.ign, joinedAt: Date.now(), isWinner: false, isManual: true
                  });
                  addToast("Verified & Auto-Entered into active Raffle!", 'success');
              } else addToast("Verified successfully!", 'success');
          } else addToast("Verified successfully!", 'success');
      } catch (e) { console.error(e); }
      
      // Perform final update
      await updateDoc(doc(db, `scavenger_hunts/${verificationHuntId}/participants`, verificationParticipant.id), updateData);
      setVerificationParticipant(null);
      setVerificationHuntId(null);

      // Clear URL params
      const currentUrl = window.location.href;
      const [baseUrl] = currentUrl.split('?');
      window.history.replaceState({}, document.title, baseUrl);
      setVerifying(false);
  };

  const handleMassVerify = async () => {
      const completed = participants.filter(p => {
          const foundCount = p.foundTargetIds?.length || 0;
          const totalCount = p.assignedTargets?.length || (p as any).assignedPokemon?.length || 5;
          return foundCount > 0 && foundCount === totalCount && !p.isVerified;
      });
      if (completed.length === 0) { addToast("No pending players to verify.", "warning"); return; }
      
      setVerifying(true);
      let raffleIdToAssign: string | null = null;
      try {
          const raffleQ = query(collection(db, 'raffle_sessions'), where('active', '==', true));
          const raffleSnap = await getDocs(raffleQ);
          if (!raffleSnap.empty) {
              const activeRaffle = raffleSnap.docs.find(d => {
                  const rData = d.data();
                  return (currentUser && rData.hostUid === currentUser.uid) || 
                         (discordUser && rData.discordUid === discordUser.id) || 
                         (rData.hostDevice === myDeviceId);
              });
              if (activeRaffle) raffleIdToAssign = activeRaffle.id;
          }

          // Process all verifications and raffle entries in parallel
          await Promise.all(completed.map(async (p) => {
              let updateData: any = { isVerified: true, verifiedAt: Date.now() };
              if (raffleIdToAssign) {
                  updateData.raffleId = raffleIdToAssign;
                  await setDoc(doc(db, `raffle_sessions/${raffleIdToAssign}/participants`, p.id), {
                      id: p.id, deviceId: p.deviceId, name: p.name || 'Trainer', ign: p.ign, joinedAt: Date.now(), isWinner: false, isManual: true
                  });
              }
              await updateDoc(doc(db, `scavenger_hunts/${currentHunt!.id}/participants`, p.id), updateData);
          }));
          addToast(`Successfully verified ${completed.length} players!`, "success");
      } catch (e) { addToast("Error during mass verification.", "error"); }
      finally { setVerifying(false); }
  };

  const handleUnverify = async (p: any) => {
      if (!currentHunt) return;
      setVerifying(true);
      try {
          // If they were added to a raffle, silently remove them so they don't get duplicate entries
          if (p.raffleId) {
              await deleteDoc(doc(db, `raffle_sessions/${p.raffleId}/participants`, p.id));
          }
          
          // Revert their Scavenger Hunt status
          await updateDoc(doc(db, `scavenger_hunts/${currentHunt.id}/participants`, p.id), {
              isVerified: false,
              verifiedAt: deleteField(),
              raffleId: deleteField()
          });
          
          addToast("Player un-verified.", "info");
      } catch (e) {
          console.error(e);
          addToast("Error un-verifying player.", "error");
      } finally {
          setVerifying(false);
      }
  };

  const handleKickParticipant = async () => {
      if (!participantToKick || !currentHunt) return;
      try {
          await deleteDoc(doc(db, `scavenger_hunts/${currentHunt.id}/participants`, participantToKick));
          setParticipantToKick(null);
          addToast("Player removed.", "success");
      } catch(e) {
          addToast("Error removing player.", "error");
      }
  };

  const handleQuickAdd = async (layerIndex: number) => {
      const idsText = quickAddInputs[layerIndex] || '';
      if (!idsText.trim()) return;
      setIsFetchingPokemon(true);
      
      // Parse comma-separated string into an array of valid numbers
      const ids = idsText.split(',')
          .map(s => parseInt(s.trim()))
          .filter(n => !isNaN(n) && n > 0 && n <= 1025); // Max current pokedex
      
      if (ids.length === 0) {
          addToast("No valid Dex IDs found.", 'error');
          setIsFetchingPokemon(false);
          return;
      }

      const fetchedTargets: ScavengerTarget[] = [];
      
      for (const dexId of ids) {
          try {
              const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${dexId}`);
              if (res.ok) {
                  const data = await res.json();
                  // Capitalize first letter (e.g., 'bulbasaur' -> 'Bulbasaur')
                  const capitalizedName = data.name.charAt(0).toUpperCase() + data.name.slice(1);
                  fetchedTargets.push({
                      id: uuidv4(),
                      name: capitalizedName,
                      pokedexId: dexId
                  });
              }
          } catch (e) {
              console.error(`Failed to fetch Pokemon #${dexId}`, e);
          }
      }

      if (fetchedTargets.length > 0) {
          const newLayers = [...layers];
          newLayers[layerIndex].targets = [...newLayers[layerIndex].targets, ...fetchedTargets];
          setLayers(newLayers);
          
          const newInputs = { ...quickAddInputs };
          newInputs[layerIndex] = '';
          setQuickAddInputs(newInputs); // Clear the input after success
          
          addToast(`Added ${fetchedTargets.length} Pokémon successfully!`, 'success');
      } else {
          addToast("Failed to fetch Pokémon data. Check your IDs.", 'error');
      }
      
      setIsFetchingPokemon(false);
  };

  const handleCreateNew = () => {
      const newId = uuidv4();
      const newHunt: any = {
          id: newId,
          title: '',
          description: '',
          active: true,
          createdAt: Date.now(),
          gameMode: 'sequential',
          pokemonPool: [],
          scavengerLayers: [{ id: uuidv4(), name: 'Layer 1', drawRequirement: 5, targets: [] }],
          tasks: [],
          ambassador: settings?.ambassador || null,
          hostUid: currentUser ? currentUser.uid : null,
          discordUid: discordUser ? discordUser.id : null,
          hostDevice: myDeviceId
      };
      setCurrentHunt(newHunt as ScavengerHunt);
      // Reset Form
      setHuntTitle('');
      setHuntDesc('');
      setHuntMode('sequential');
      setPokemonPoolText('');
      setLayers(newHunt.scavengerLayers);
      setTasks([]);
      setViewState('EDIT_HUNT');
  };

  const handleEditHunt = (hunt: ScavengerHunt) => {
      setCurrentHunt(hunt);
      setHuntTitle(hunt.title);
      setHuntDesc(hunt.description);
      setHuntMode(hunt.gameMode || 'sequential');
      setPokemonPoolText(hunt.pokemonPool?.join(', ') || '');
      setLayers(hunt.scavengerLayers?.length ? hunt.scavengerLayers : [{ id: uuidv4(), name: 'Legacy Targets', drawRequirement: hunt.targets?.length || 5, targets: hunt.targets || [] }]);
      setTasks(hunt.tasks || []);
      setViewState('EDIT_HUNT');
  };

  const handleSaveHunt = async () => {
      if (!currentHunt) return;
      if (!huntTitle.trim()) { addToast("Title required", 'error'); return; }

      const updatedHunt: ScavengerHunt = {
          ...currentHunt,
          title: huntTitle,
          description: huntDesc,
          gameMode: huntMode,
          pokemonPool: pokemonPoolText.split(',').map(p => p.trim()).filter(p => p !== ''),
          scavengerLayers: layers,
          tasks: tasks,
          ambassador: settings?.ambassador || null
      };
      // Safely sanitize any undefined properties before saving to Firebase to prevent silent crashes
      Object.keys(updatedHunt).forEach(key => (updatedHunt as any)[key] === undefined && delete (updatedHunt as any)[key]);

      try {
          await setDoc(doc(db, 'scavenger_hunts', updatedHunt.id), updatedHunt);
          setViewState('LIST');
      } catch (e) {
          addToast("Error saving hunt", 'error');
      }
  };

  const handleDeleteHunt = async () => {
      if (!itemToDelete) return;
      await deleteDoc(doc(db, 'scavenger_hunts', itemToDelete));
      setItemToDelete(null);
      setShowDeleteModal(false);
  };

  const handleMonitor = (hunt: ScavengerHunt) => {
      setCurrentHunt(hunt);
      setViewState('MONITOR');
  };

  const constructJoinUrl = () => {
      if (!currentHunt) return '';
      let baseUrl = window.location.origin + window.location.pathname;
      if (baseUrl.endsWith('/')) { baseUrl = baseUrl.slice(0, -1); }
      return `${baseUrl}/#/scavenger/play/${currentHunt.id}`;
  };

  const handleCopyLink = () => {
      navigator.clipboard.writeText(constructJoinUrl());
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
  };

  // --- RENDER LIST ---
  if (viewState === 'LIST') {
      return (
        <div className="h-full w-full bg-gray-950 flex flex-col text-white relative">
            <ConfirmationModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} onConfirm={handleDeleteHunt} title="Delete Hunt?" message="This cannot be undone." confirmText="Delete" isDanger={true} />
            
            {/* VERIFICATION MODAL for when loaded from URL params but in LIST view */}
            <AnimatePresence>
                {verificationParticipant && (
                    <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6" onClick={() => setVerificationParticipant(null)}>
                        <div className="bg-gray-900 border border-green-500/50 p-6 w-full max-w-md shadow-[0_0_50px_rgba(0,0,0,0.8)] rounded-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                            {/* Header */}
                            <div className="flex items-center gap-4 mb-6 border-b border-gray-800 pb-4 shrink-0">
                                <div className="w-16 h-16 bg-green-900/20 rounded-full flex items-center justify-center border border-green-500/50 shrink-0 shadow-[0_0_15px_rgba(34,197,94,0.2)]">
                                    <CheckCircle size={32} className="text-green-400" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-white leading-none tracking-tight">{verificationParticipant.ign}</h3>
                                    <p className="text-[10px] text-green-400 font-black uppercase tracking-widest mt-1.5">Ready for Verification</p>
                                </div>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                                {/* Catch List Grid */}
                                <div>
                                    <h4 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-3 flex items-center gap-2"><Map size={14} className="text-blue-400"/> Catch-List Matches</h4>
                                    <div className="grid grid-cols-3 gap-2">
                                        {verificationParticipant.assignedTargets?.map((t, i) => (
                                            <div key={i} className="bg-gray-950 border border-gray-800 rounded-xl p-2 flex flex-col items-center text-center justify-center relative overflow-hidden group min-h-[90px]">
                                                {t.pokedexId ? (
                                                    <img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${t.pokedexId}.png`} alt={t.name} className="w-16 h-16 object-contain drop-shadow-md relative z-10 group-hover:scale-110 transition-transform" />
                                                ) : (
                                                    <div className="w-12 h-12 flex items-center justify-center bg-gray-900 rounded-full mb-1 relative z-10"><Map size={20} className="text-gray-700"/></div>
                                                )}
                                                <span className="text-[10px] font-bold text-white relative z-10 mt-1">{t.name}</span>
                                                {/* Background glow */}
                                                <div className="absolute inset-0 bg-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        ))}
                                        {!verificationParticipant.assignedTargets?.length && (
                                            <div className="col-span-3 text-center text-gray-600 text-xs py-4 italic border border-gray-800 border-dashed rounded-xl">No specific targets assigned.</div>
                                        )}
                                    </div>
                                </div>

                                {/* Real World Tasks */}
                                {currentHunt?.tasks && currentHunt.tasks.length > 0 && (
                                    <div>
                                        <h4 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-3 flex items-center gap-2"><ClipboardList size={14} className="text-purple-400"/> Required Tasks</h4>
                                        <div className="space-y-2">
                                            {currentHunt.tasks.map(task => (
                                                <div key={task.id} className="bg-gray-950 border border-gray-800 rounded-xl p-3 flex gap-3 items-start">
                                                    <div className="w-5 h-5 rounded border-2 border-gray-700 flex-shrink-0 mt-0.5" />
                                                    <div>
                                                        <div className="text-sm font-bold text-white leading-tight">{task.title}</div>
                                                        {task.description && <div className="text-[10px] text-gray-500 mt-1 leading-snug">{task.description}</div>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* Footer Buttons */}
                            <div className="flex gap-2 mt-6 pt-4 border-t border-gray-800 shrink-0">
                                <Button variant="secondary" className="flex-1 border-gray-700 bg-gray-800 text-white h-14" onClick={() => setVerificationParticipant(null)}>Cancel</Button>
                                <Button 
                                    className="bg-green-600 hover:bg-green-500 border-none text-white font-black h-14 flex-[2] text-sm shadow-[0_0_15px_rgba(34,197,94,0.3)]" 
                                    onClick={handleVerifyComplete}
                                    disabled={verifying}
                                >
                                    {verifying ? 'VERIFYING...' : 'VERIFY & ENTER RAFFLE'}
                                </Button>
                            </div>
                        </div>
                    </MotionDiv>
                )}
            </AnimatePresence>

            <div className="p-4 border-b border-gray-800 flex items-center gap-4 bg-gray-900 sticky top-0 z-30">
                <button onClick={() => navigate('/')} className="p-2 bg-gray-800 rounded-full border border-gray-700 text-gray-400 hover:text-white"><ArrowLeft size={20}/></button>
                <div><h2 className="text-xl font-bold text-green-400">Scavenger Hunts</h2><p className="text-xs text-gray-500">Catch-List Adventures</p></div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <button onClick={handleCreateNew} className="w-full p-4 border-2 border-dashed border-gray-800 flex flex-col items-center justify-center text-gray-500 hover:border-green-500 hover:text-green-500 transition-colors gap-2">
                    <Plus size={24}/> <span className="font-bold">Create New Hunt</span>
                </button>

                {hunts.map((hunt, index) => (
                    <div key={hunt.id || index} className="bg-gray-900 border border-gray-800 p-4">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h3 className="text-lg font-bold text-white">{hunt.title || 'Untitled Hunt'}</h3>
                                <div className="text-xs text-gray-500 flex items-center gap-2">
                                    <Map size={12}/> {hunt.scavengerLayers ? hunt.scavengerLayers.reduce((acc: number, layer: any) => acc + (layer.targets?.length || 0), 0) : (hunt.pokemonPool?.length || 0)} Pokémon listed
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleMonitor(hunt)} className="p-2 bg-blue-900/20 text-blue-400 hover:bg-blue-900/40"><Users size={16}/></button>
                                <button onClick={() => handleEditHunt(hunt)} className="p-2 bg-gray-800 text-gray-400 hover:text-white"><Edit2 size={16}/></button>
                                <button onClick={() => { setItemToDelete(hunt.id); setShowDeleteModal(true); }} className="p-2 bg-gray-800 text-gray-400 hover:text-red-400"><Trash2 size={16}/></button>
                            </div>
                        </div>
                        <div className="text-sm text-gray-400 line-clamp-2">{hunt.description}</div>
                    </div>
                ))}
            </div>
        </div>
      )
  }

  // --- RENDER MONITOR ---
  if (viewState === 'MONITOR' && currentHunt) {
      return (
        <div className="h-full w-full bg-gray-950 flex flex-col text-white relative">
            {/* VERIFICATION MODAL */}
            <ConfirmationModal isOpen={!!participantToKick} onClose={() => setParticipantToKick(null)} onConfirm={handleKickParticipant} title="Remove User?" message="Remove this participant from the hunt?" confirmText="Remove" isDanger={true} />
            <AnimatePresence>
                {verificationParticipant && (
                    <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6" onClick={() => setVerificationParticipant(null)}>
                        <div className="bg-gray-900 border border-green-500/50 p-6 w-full max-w-md shadow-[0_0_50px_rgba(0,0,0,0.8)] rounded-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                            {/* Header */}
                            <div className="flex items-center gap-4 mb-6 border-b border-gray-800 pb-4 shrink-0">
                                <div className="w-16 h-16 bg-green-900/20 rounded-full flex items-center justify-center border border-green-500/50 shrink-0 shadow-[0_0_15px_rgba(34,197,94,0.2)]">
                                    <CheckCircle size={32} className="text-green-400" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-white leading-none tracking-tight">{verificationParticipant.ign}</h3>
                                    <p className="text-[10px] text-green-400 font-black uppercase tracking-widest mt-1.5">Ready for Verification</p>
                                </div>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                                {/* Catch List Grid */}
                                <div>
                                    <h4 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-3 flex items-center gap-2"><Map size={14} className="text-blue-400"/> Catch-List Matches</h4>
                                    <div className="grid grid-cols-3 gap-2">
                                        {verificationParticipant.assignedTargets?.map((t, i) => (
                                            <div key={i} className="bg-gray-950 border border-gray-800 rounded-xl p-2 flex flex-col items-center text-center justify-center relative overflow-hidden group min-h-[90px]">
                                                {t.pokedexId ? (
                                                    <img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${t.pokedexId}.png`} alt={t.name} className="w-16 h-16 object-contain drop-shadow-md relative z-10 group-hover:scale-110 transition-transform" />
                                                ) : (
                                                    <div className="w-12 h-12 flex items-center justify-center bg-gray-900 rounded-full mb-1 relative z-10"><Map size={20} className="text-gray-700"/></div>
                                                )}
                                                <span className="text-[10px] font-bold text-white relative z-10 mt-1">{t.name}</span>
                                                {/* Background glow */}
                                                <div className="absolute inset-0 bg-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        ))}
                                        {!verificationParticipant.assignedTargets?.length && (
                                            <div className="col-span-3 text-center text-gray-600 text-xs py-4 italic border border-gray-800 border-dashed rounded-xl">No specific targets assigned.</div>
                                        )}
                                    </div>
                                </div>

                                {/* Real World Tasks */}
                                {currentHunt?.tasks && currentHunt.tasks.length > 0 && (
                                    <div>
                                        <h4 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-3 flex items-center gap-2"><ClipboardList size={14} className="text-purple-400"/> Required Tasks</h4>
                                        <div className="space-y-2">
                                            {currentHunt.tasks.map(task => (
                                                <div key={task.id} className="bg-gray-950 border border-gray-800 rounded-xl p-3 flex gap-3 items-start">
                                                    <div className="w-5 h-5 rounded border-2 border-gray-700 flex-shrink-0 mt-0.5" />
                                                    <div>
                                                        <div className="text-sm font-bold text-white leading-tight">{task.title}</div>
                                                        {task.description && <div className="text-[10px] text-gray-500 mt-1 leading-snug">{task.description}</div>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* Footer Buttons */}
                            <div className="flex gap-2 mt-6 pt-4 border-t border-gray-800 shrink-0">
                                <Button variant="secondary" className="flex-1 border-gray-700 bg-gray-800 text-white h-14" onClick={() => setVerificationParticipant(null)}>Cancel</Button>
                                <Button 
                                    className="bg-green-600 hover:bg-green-500 border-none text-white font-black h-14 flex-[2] text-sm shadow-[0_0_15px_rgba(34,197,94,0.3)]" 
                                    onClick={handleVerifyComplete}
                                    disabled={verifying}
                                >
                                    {verifying ? 'VERIFYING...' : 'VERIFY & ENTER RAFFLE'}
                                </Button>
                            </div>
                        </div>
                    </MotionDiv>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showQrModal && (
                    <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6" onClick={() => setShowQrModal(false)}>
                        <div className="bg-white p-6" onClick={e => e.stopPropagation()}><QRCodeSVG value={constructJoinUrl()} size={250} /></div>
                        <div className="mt-8"><button onClick={handleCopyLink} className="px-6 py-3 bg-gray-800 rounded-full text-sm font-bold flex items-center gap-2">{linkCopied ? <Check size={16}/> : <LinkIcon size={16}/>} {linkCopied ? 'Copied' : 'Copy Link'}</button></div>
                    </MotionDiv>
                )}
            </AnimatePresence>

            <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900 sticky top-0 z-30">
                <div className="flex items-center gap-4">
                    <button onClick={() => setViewState('LIST')} className="p-2 bg-gray-800 rounded-full border border-gray-700 text-gray-400 hover:text-white"><ArrowLeft size={20}/></button>
                    <div><h2 className="text-xl font-bold">{currentHunt.title}</h2><p className="text-xs text-gray-500">Live Monitor</p></div>
                </div>
                <button onClick={() => setShowQrModal(true)} className="p-2 bg-green-600 rounded-full text-white hover:bg-green-500"><QrCode size={20}/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                <div className="flex justify-between items-center mb-4 text-xs font-bold text-gray-500 uppercase">
                    <div className="text-xs font-bold text-gray-500 uppercase">Players ({participants.length})</div>
                    <Button onClick={handleMassVerify} variant="secondary" className="h-8 text-xs bg-green-900/20 text-green-400 border-green-500 hover:bg-green-600 hover:text-white transition-colors">Verify All Completed</Button>
                </div>
                            <div className="space-y-2">
                                {participants.length === 0 && <div className="text-center text-gray-700 text-xs py-10 italic">Waiting for entries...</div>}
                                {[...participants]
                                    .sort((a, b) => {
                                        // 1. Verified players ALWAYS go to the top, sorted strictly by WHEN they were verified
                                        if (a.isVerified && b.isVerified) return ((a as any).verifiedAt || 0) - ((b as any).verifiedAt || 0);
                                        if (a.isVerified) return -1;
                                        if (b.isVerified) return 1;
                                        
                                        // 2. Unverified players sorted by most targets found
                                        const aFound = a.foundTargetIds?.length || 0;
                                        const bFound = b.foundTargetIds?.length || 0;
                                        if (bFound !== aFound) return bFound - aFound; 
                                        
                                        // 3. Tie-breaker by join time
                                        return (a.joinedAt as any) - (b.joinedAt as any);
                                    })
                                    .map((p, index) => {
                                        const foundCount = p.foundTargetIds?.length || 0;
                                        const totalCount = p.assignedTargets?.length || (p as any).assignedPokemon?.length || 5;
                                        const isDone = foundCount > 0 && foundCount === totalCount;
                                        
                                        return (
                                            <div key={p.id} className={`text-sm p-3 border flex justify-between items-center transition-all ${isDone ? 'bg-green-900/20 border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.1)]' : 'bg-gray-950 border-gray-800'}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`font-black w-6 text-center ${index < 3 ? 'text-yellow-500' : 'text-gray-600'}`}>#{index + 1}</div>
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                            {(p as any).isManual ? <ClipboardList size={12} className="text-gray-500"/> : <Users size={12} className="text-blue-500"/>}
                                                            <span className={`font-bold ${isDone ? 'text-green-400' : 'text-white'}`}>{p.ign}</span>
                                                        </div>
                                                        {(p as any).name && <span className="text-[10px] text-gray-500">{(p as any).name}</span>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="flex flex-col items-end">
                                                        <span className={`text-xs font-black tracking-widest ${isDone ? 'text-green-400' : 'text-purple-400'}`}>{foundCount} / {totalCount}</span>
                                                        <span className="text-[9px] uppercase text-gray-500">{p.isVerified ? 'Verified' : isDone ? 'Pending Check' : 'Found'}</span>
                                                    </div>
                                                    {isDone && !p.isVerified && (
                                                        <button onClick={() => { setVerificationParticipant(p); setVerificationHuntId(currentHunt.id); }} className="px-2 py-1 bg-green-600 text-white rounded text-[10px] font-bold uppercase hover:bg-green-500">Verify</button>
                                                    )}
                                                    {p.isVerified && (
                                                        <button onClick={() => handleUnverify(p)} className="px-2 py-1 bg-gray-800 text-gray-400 border border-gray-700 rounded text-[10px] font-bold uppercase hover:bg-gray-700 hover:text-white transition-colors">Undo</button>
                                                    )}
                                                    <button onClick={() => setParticipantToKick(p.id!)} className="text-gray-700 hover:text-red-500 p-1"><X size={14}/></button>
                                                </div>
                                            </div>
                                        );
                                })}
                            </div>
            </div>
        </div>
      )
  }

  // --- RENDER EDITOR ---
  return (
    <div className="h-full w-full bg-gray-950 flex flex-col text-white relative">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900 sticky top-0 z-30">
            <div className="flex items-center gap-4">
                <button onClick={() => setViewState('LIST')} className="p-2 bg-gray-800 rounded-full border border-gray-700 text-gray-400 hover:text-white"><ArrowLeft size={20}/></button>
                <h2 className="text-xl font-bold">Edit Hunt</h2>
            </div>
            <Button onClick={handleSaveHunt} className="h-9 px-4 text-sm">Save</Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div className="space-y-4">
                <div><label className="text-xs text-gray-500 uppercase font-bold">Title</label><input className="w-full bg-gray-900 border border-gray-800 p-3 focus:border-green-500 outline-none" value={huntTitle} onChange={e => setHuntTitle(e.target.value)} placeholder="Hunt Title"/></div>
                <div><label className="text-xs text-gray-500 uppercase font-bold">Description</label><textarea className="w-full bg-gray-900 border border-gray-800 p-3 focus:border-green-500 outline-none" value={huntDesc} onChange={e => setHuntDesc(e.target.value)} placeholder="Instructions..."/></div>
            </div>

            <div className="border-t border-gray-800 pt-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-400 uppercase text-xs">Hunt Layers</h3>
                </div>
                
                <div className="space-y-4">
                    <p className="text-xs text-gray-500 mb-4">Organize your targets into layers (e.g. Common, Rare) to assign specific numbers of varying targets to players.</p>

                    {layers.map((layer, layerIndex) => (
                        <div key={layer.id} className="border border-gray-700 bg-gray-900 p-4 rounded-xl">
                            {/* Layer Header */}
                            <div className="flex gap-2 mb-4">
                                <input 
                                    type="text" 
                                    value={layer.name} 
                                    placeholder="Layer Name (e.g. Wild Spawns)" 
                                    className="flex-1 bg-gray-950 border border-gray-800 p-2 text-sm text-white focus:border-green-500 outline-none rounded" 
                                    onChange={e => {
                                        const newLayers = [...layers];
                                        newLayers[layerIndex].name = e.target.value;
                                        setLayers(newLayers);
                                    }} 
                                />
                                <input 
                                    type="number" 
                                    value={layer.drawRequirement || 0} 
                                    placeholder="Draw Count" 
                                    className="w-24 bg-gray-950 border border-gray-800 p-2 text-sm text-white focus:border-green-500 outline-none rounded" 
                                    onChange={e => {
                                        const newLayers = [...layers];
                                        newLayers[layerIndex].drawRequirement = parseInt(e.target.value) || 0;
                                        setLayers(newLayers);
                                    }} 
                                />
                                <button 
                                    onClick={() => setLayers(layers.filter(l => l.id !== layer.id))} 
                                    className="px-3 bg-red-900/30 text-red-500 hover:bg-red-900/50 hover:text-red-400 border border-red-500/50 rounded flex items-center justify-center transition-colors"
                                    title="Remove Layer"
                                >
                                    <Trash2 size={16}/>
                                </button>
                            </div>
                            
                            {/* QUICK ADD BY DEX # */}
                            <div className="flex items-center gap-2 mb-4 bg-gray-950 border border-gray-800 p-2 rounded">
                                <input
                                    type="text"
                                    className="flex-1 bg-transparent border-none outline-none text-sm text-white px-2 placeholder-gray-600"
                                    placeholder="Quick Add Dex IDs (e.g., 1, 4, 7)"
                                    value={quickAddInputs[layerIndex] || ''}
                                    onChange={e => {
                                        const newInputs = { ...quickAddInputs };
                                        newInputs[layerIndex] = e.target.value;
                                        setQuickAddInputs(newInputs);
                                    }}
                                    onKeyDown={e => e.key === 'Enter' && handleQuickAdd(layerIndex)}
                                />
                                <Button 
                                    variant="secondary" 
                                    onClick={() => handleQuickAdd(layerIndex)} 
                                    disabled={isFetchingPokemon || !(quickAddInputs[layerIndex] || '').trim()}
                                    className="h-8 text-xs bg-purple-900/30 text-purple-400 border-purple-500/50 hover:bg-purple-900/50"
                                >
                                    {isFetchingPokemon ? 'Fetching...' : 'Quick Add'}
                                </Button>
                            </div>

                            {/* Target Mapping for this specific layer */}
                            <div className="space-y-2 mb-4">
                                {layer.targets.map((target, targetIndex) => (
                                    <div key={target.id} className="flex items-center gap-2 bg-gray-950 border border-gray-800 p-2 rounded">
                                        <input
                                            type="text"
                                            className="flex-1 bg-transparent border-none outline-none text-sm text-white px-2"
                                            placeholder="Pokémon Name"
                                            value={target.name}
                                            onChange={e => {
                                                const newLayers = [...layers];
                                                newLayers[layerIndex].targets[targetIndex].name = e.target.value;
                                                setLayers(newLayers);
                                            }}
                                        />
                                        <input
                                            type="number"
                                            className="w-24 bg-gray-900 border border-gray-800 outline-none text-sm text-white px-2 py-1 rounded focus:border-green-500"
                                            placeholder="Dex #"
                                            value={target.pokedexId || ''}
                                            onChange={e => {
                                                const newLayers = [...layers];
                                                newLayers[layerIndex].targets[targetIndex].pokedexId = e.target.value ? parseInt(e.target.value) : null;
                                                setLayers(newLayers);
                                            }}
                                        />
                                        <button
                                            onClick={() => {
                                                const newLayers = [...layers];
                                                newLayers[layerIndex].targets = newLayers[layerIndex].targets.filter(t => t.id !== target.id);
                                                setLayers(newLayers);
                                            }}
                                            className="p-1.5 text-gray-500 hover:text-red-400 rounded-full"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                                {layer.targets.length === 0 && (
                                    <div className="text-center text-gray-600 text-sm py-4 border border-dashed border-gray-800 rounded">
                                        No targets in this layer.
                                    </div>
                                )}
                            </div>
                            
                            {/* Add Target */}
                            <Button 
                                variant="secondary" 
                                onClick={() => {
                                    const newLayers = [...layers];
                                    newLayers[layerIndex].targets.push({ id: uuidv4(), name: '', pokedexId: null, layerName: layer.name });
                                    setLayers(newLayers);
                                }} 
                                className="text-xs py-1 h-8 px-3"
                            >
                                <Plus size={14} className="mr-1" /> Add Target to {layer.name || 'Layer'}
                            </Button>
                        </div>
                    ))}
                    
                    <Button 
                        onClick={() => setLayers([...layers, { id: uuidv4(), name: `Layer ${layers.length + 1}`, drawRequirement: 1, targets: [] }])}
                        className="w-full bg-gray-800 hover:bg-gray-700 text-white border-dashed border border-gray-600"
                    >
                        <Plus size={16} className="mr-2" /> Add New Layer
                    </Button>
                </div>

                <div className="mt-6 mb-4">
                    <h3 className="font-bold text-gray-400 uppercase text-xs">Real-World Tasks (Optional)</h3>
                </div>
                
                <div className="space-y-4">
                    <p className="text-xs text-gray-500 mb-2">Create custom tasks for players to complete (e.g. "Take a group selfie", "Find the hidden tag").</p>
                    
                    {tasks.map((task, index) => (
                        <div key={task.id} className="bg-gray-950 border border-gray-800 p-3 rounded flex items-start gap-3">
                            <div className="flex-1 space-y-2">
                                <input 
                                    type="text" 
                                    placeholder="Task Title (e.g. 'Create Scavenger Tag')" 
                                    className="w-full bg-transparent border-b border-gray-800 pb-1 text-sm text-white focus:border-green-500 outline-none font-bold"
                                    value={task.title}
                                    onChange={e => {
                                        const newTasks = [...tasks];
                                        newTasks[index].title = e.target.value;
                                        setTasks(newTasks);
                                    }}
                                />
                                <textarea 
                                    placeholder="Detailed instructions... (Optional)" 
                                    className="w-full bg-transparent border-none text-xs text-gray-400 outline-none resize-none"
                                    rows={2}
                                    value={task.description}
                                    onChange={e => {
                                        const newTasks = [...tasks];
                                        newTasks[index].description = e.target.value;
                                        setTasks(newTasks);
                                    }}
                                />
                            </div>
                            <button onClick={() => setTasks(tasks.filter(t => t.id !== task.id))} className="p-2 text-gray-600 hover:text-red-500 transition-colors">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                    
                    <Button 
                        variant="secondary" 
                        onClick={() => setTasks([...tasks, { id: uuidv4(), title: '', description: '' }])}
                        className="w-full border-dashed border border-gray-700 bg-gray-900 text-gray-400 hover:text-white"
                    >
                        <Plus size={16} className="mr-2" /> Add Task
                    </Button>
                </div>
            </div>
        </div>
    </div>
  );
};

