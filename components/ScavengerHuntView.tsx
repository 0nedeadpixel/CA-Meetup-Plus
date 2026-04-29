
import React, { useEffect, useState } from 'react';
import { ArrowLeft, Map, Plus, Trash2, Edit2, Save, X, Navigation, LocateFixed, Eye, EyeOff, Lock, ChevronRight, GripVertical, QrCode, Share2, Copy, AlertTriangle, Users, Shuffle, ListOrdered, Search, User, Link as LinkIcon, Check, Play, CheckCircle } from 'lucide-react';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import { Button } from './Button';
import { auth, db } from '../firebase';
// @ts-ignore
import { onAuthStateChanged } from 'firebase/auth';
// @ts-ignore
import { doc, getDoc, collection, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, query, orderBy, setDoc } from 'firebase/firestore';
import { ScavengerHunt, ScavengerParticipant, AppSettings } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { QRCodeSVG } from 'qrcode.react';
import { ConfirmationModal } from './ConfirmationModal';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from './ToastContext';

// Fix for framer-motion type mismatch
const MotionDiv = motion.div as any;

interface ScavengerHuntViewProps {
    settings: AppSettings;
}

export const ScavengerHuntView: React.FC<ScavengerHuntViewProps> = ({ settings }) => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [userRole, setUserRole] = useState<'super_admin' | 'admin' | 'host' | 'user'>('user');

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
  
  // Pokemon Pool
  const [pokemonPoolText, setPokemonPoolText] = useState('');

  // UI State
  const [linkCopied, setLinkCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Verification
  const [verificationParticipant, setVerificationParticipant] = useState<ScavengerParticipant | null>(null);
  const [verificationHuntId, setVerificationHuntId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // 1. Fetch Hunts
  useEffect(() => {
      // Allow super_admins, OR people with a currentUser, OR people with a 'host' role
      if (!currentUser && userRole !== 'super_admin' && userRole !== 'host') return;

      const q = query(collection(db, 'scavenger_hunts'), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(q, (snap: any) => {
          const list = snap.docs.map((d: any) => ({ ...d.data() } as ScavengerHunt))
              .filter((hunt: ScavengerHunt) => {
                  // Strict Padlock: Only show hunts explicitly owned by this user
                  if (currentUser && hunt.hostUid === currentUser.uid) return true;
                  return false;
              });
          setHunts(list);
      });
      return () => unsub();
  }, [currentUser, userRole]);

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
                      
                      const huntData = huntSnap.data() as ScavengerHunt;
                      
                      // SECURITY CHECK: Does this belong to the logged-in Ambassador?
                      if (huntData.hostUid && huntData.hostUid !== currentUser.uid) {
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
  }, [currentUser, addToast]);

  // --- ACTIONS ---

  const handleVerifyComplete = async () => {
      if (!verificationParticipant || !verificationHuntId) return;
      setVerifying(true);
      try {
          await updateDoc(doc(db, `scavenger_hunts/${verificationHuntId}/participants`, verificationParticipant.id), {
              isVerified: true
          });
          addToast("Verified successfully!", 'success');
          setVerificationParticipant(null);
          setVerificationHuntId(null);
          
          // Clear URL params
          const currentUrl = window.location.href;
          const [baseUrl] = currentUrl.split('?');
          window.history.replaceState({}, document.title, baseUrl);
      } catch (e) {
          addToast("Error verifying player", 'error');
      } finally {
          setVerifying(false);
      }
  };

  const handleCreateNew = () => {
      const newId = uuidv4();
      const newHunt: ScavengerHunt = {
          id: newId,
          title: '',
          description: '',
          active: true,
          createdAt: Date.now(),
          gameMode: 'sequential',
          pokemonPool: [],
          ambassador: settings.ambassador,
          hostUid: currentUser?.uid || ''
      };
      setCurrentHunt(newHunt);
      // Reset Form
      setHuntTitle('');
      setHuntDesc('');
      setHuntMode('sequential');
      setPokemonPoolText('');
      setViewState('EDIT_HUNT');
  };

  const handleEditHunt = (hunt: ScavengerHunt) => {
      setCurrentHunt(hunt);
      setHuntTitle(hunt.title);
      setHuntDesc(hunt.description);
      setHuntMode(hunt.gameMode || 'sequential');
      setPokemonPoolText(hunt.pokemonPool?.join(', ') || '');
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
          ambassador: settings.ambassador // Update profile if changed
      };

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
                        <div className="bg-gray-900 border border-green-500/30 p-8 w-full max-w-sm text-center shadow-2xl" onClick={e => e.stopPropagation()}>
                            <div className="w-16 h-16 bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/50">
                                <CheckCircle size={32} className="text-green-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Verify Player</h3>
                            <p className="text-sm text-gray-400 mb-4"><span className="font-bold text-white">{verificationParticipant.ign}</span> has completed the hunt!</p>
                            
                            <div className="bg-gray-950 border border-gray-800 p-4 rounded mb-6 text-left max-h-[200px] overflow-y-auto">
                                <h4 className="text-xs uppercase text-gray-500 font-bold mb-2">Their Catch-List</h4>
                                <ul className="list-disc pl-4 space-y-1">
                                    {verificationParticipant.assignedPokemon?.map((poke, i) => (
                                        <li key={i} className="text-sm text-green-400">{poke}</li>
                                    ))}
                                    {(!verificationParticipant.assignedPokemon || verificationParticipant.assignedPokemon.length === 0) && (
                                        <li className="text-sm text-gray-500">None</li>
                                    )}
                                </ul>
                            </div>
                            
                            <div className="flex gap-2">
                                <Button variant="secondary" className="flex-1" onClick={() => setVerificationParticipant(null)}>Cancel</Button>
                                <Button 
                                    className="bg-green-600 hover:bg-green-500 border-none text-white font-bold h-10 flex-[2]" 
                                    onClick={handleVerifyComplete}
                                    disabled={verifying}
                                >
                                    {verifying ? 'Verifying...' : 'Mark as Verified'}
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
                                    <Map size={12}/> {hunt.pokemonPool?.length || 0} Pokémon listed
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
            <AnimatePresence>
                {verificationParticipant && (
                    <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6" onClick={() => setVerificationParticipant(null)}>
                        <div className="bg-gray-900 border border-green-500/30 p-8 w-full max-w-sm text-center shadow-2xl" onClick={e => e.stopPropagation()}>
                            <div className="w-16 h-16 bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/50">
                                <CheckCircle size={32} className="text-green-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Verify Player</h3>
                            <p className="text-sm text-gray-400 mb-4"><span className="font-bold text-white">{verificationParticipant.ign}</span> has completed the hunt!</p>
                            
                            <div className="bg-gray-950 border border-gray-800 p-4 rounded mb-6 text-left max-h-[200px] overflow-y-auto">
                                <h4 className="text-xs uppercase text-gray-500 font-bold mb-2">Their Catch-List</h4>
                                <ul className="list-disc pl-4 space-y-1">
                                    {verificationParticipant.assignedPokemon?.map((poke, i) => (
                                        <li key={i} className="text-sm text-green-400">{poke}</li>
                                    ))}
                                    {(!verificationParticipant.assignedPokemon || verificationParticipant.assignedPokemon.length === 0) && (
                                        <li className="text-sm text-gray-500">None</li>
                                    )}
                                </ul>
                            </div>
                            
                            <div className="flex gap-2">
                                <Button variant="secondary" className="flex-1" onClick={() => setVerificationParticipant(null)}>Cancel</Button>
                                <Button 
                                    className="bg-green-600 hover:bg-green-500 border-none text-white font-bold h-10 flex-[2]" 
                                    onClick={handleVerifyComplete}
                                    disabled={verifying}
                                >
                                    {verifying ? 'Verifying...' : 'Mark as Verified'}
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
                    <span>Players ({participants.length})</span>
                    <span>Status</span>
                </div>
                <div className="space-y-2">
                    {participants.map((p, index) => {
                        return (
                            <div key={p.id || index} className="bg-gray-900 border border-gray-800 p-3 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400"><User size={14}/></div>
                                <div className="flex-1">
                                    <div className="flex justify-between mb-1">
                                        <span className="font-bold text-white">{p.ign}</span>
                                        <span className={`text-xs ${p.isVerified ? 'text-green-400' : 'text-gray-400'}`}>{p.isVerified ? 'Verified' : 'Pending'}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 truncate max-w-[200px]">
                                        {p.assignedPokemon?.join(', ') || 'None'}
                                    </div>
                                </div>
                                {!p.isVerified && (
                                   <Button variant="secondary" onClick={() => {
                                       setVerificationParticipant(p);
                                       setVerificationHuntId(currentHunt.id);
                                   }} className="h-8 px-3 text-xs bg-green-600/20 text-green-400 border-none hover:bg-green-600/40">Verify</Button>
                                )}
                            </div>
                        )
                    })}
                    {participants.length === 0 && <div className="text-center text-gray-600 py-10">No players have joined yet.</div>}
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
                    <h3 className="font-bold text-gray-400 uppercase text-xs">Pokémon Pool</h3>
                </div>
                
                <div className="space-y-2">
                    <p className="text-xs text-gray-500 mb-2">Paste a comma-separated list of Pokémon for players to find.</p>
                    <textarea 
                        className="w-full bg-gray-900 border border-gray-800 p-3 focus:border-green-500 outline-none min-h-[150px] text-sm" 
                        value={pokemonPoolText} 
                        onChange={e => setPokemonPoolText(e.target.value)} 
                        placeholder="Pikachu, Bulbasaur, Charmander, Squirtle..."
                    />
                </div>
            </div>
        </div>
    </div>
  );
};

