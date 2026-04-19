
import React, { useEffect, useState } from 'react';
import { ArrowLeft, Map, Plus, Trash2, Edit2, Save, X, Navigation, LocateFixed, Eye, EyeOff, Lock, ChevronRight, GripVertical, QrCode, Share2, Copy, AlertTriangle, Users, Shuffle, ListOrdered, Search, User, Link as LinkIcon, Check, Play } from 'lucide-react';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import { Button } from './Button';
import { auth, db } from '../firebase';
// @ts-ignore
import { onAuthStateChanged } from 'firebase/auth';
// @ts-ignore
import { doc, getDoc, collection, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, query, orderBy, setDoc } from 'firebase/firestore';
import { ScavengerHunt, Waypoint, ScavengerParticipant, AppSettings } from '../types';
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
  
  // Waypoint Editing
  const [editingWaypoint, setEditingWaypoint] = useState<Waypoint | null>(null);
  const [showWpModal, setShowWpModal] = useState(false);
  const [wpName, setWpName] = useState('');
  const [wpClue, setWpClue] = useState('');
  const [wpLat, setWpLat] = useState<number>(0);
  const [wpLng, setWpLng] = useState<number>(0);
  const [wpRadius, setWpRadius] = useState<number>(30);

  // UI State
  const [linkCopied, setLinkCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // 1. Fetch Hunts
  useEffect(() => {
      const q = query(collection(db, 'scavenger_hunts'), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(q, (snap: any) => {
          const list = snap.docs.map((d: any) => ({ ...d.data() } as ScavengerHunt));
          setHunts(list);
      });
      return () => unsub();
  }, []);

  // 2. Fetch Participants (If Monitoring)
  useEffect(() => {
      if (viewState === 'MONITOR' && currentHunt) {
          const unsub = onSnapshot(collection(db, `scavenger_hunts/${currentHunt.id}/participants`), (snap: any) => {
              const list = snap.docs.map((d: any) => ({ ...d.data() } as ScavengerParticipant));
              // Sort by completed count descending
              list.sort((a: any, b: any) => b.completedCount - a.completedCount);
              setParticipants(list);
          });
          return () => unsub();
      }
  }, [viewState, currentHunt]);

  // --- ACTIONS ---

  const handleCreateNew = () => {
      const newId = uuidv4();
      const newHunt: ScavengerHunt = {
          id: newId,
          title: '',
          description: '',
          active: true,
          createdAt: Date.now(),
          gameMode: 'sequential',
          waypoints: [],
          ambassador: settings.ambassador
      };
      setCurrentHunt(newHunt);
      // Reset Form
      setHuntTitle('');
      setHuntDesc('');
      setHuntMode('sequential');
      setViewState('EDIT_HUNT');
  };

  const handleEditHunt = (hunt: ScavengerHunt) => {
      setCurrentHunt(hunt);
      setHuntTitle(hunt.title);
      setHuntDesc(hunt.description);
      setHuntMode(hunt.gameMode || 'sequential');
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

  // --- WAYPOINT ACTIONS ---

  const handleAddWaypoint = () => {
      setEditingWaypoint(null); // New mode
      setWpName('');
      setWpClue('');
      setWpLat(0);
      setWpLng(0);
      setWpRadius(30);
      
      // Try to get current location
      if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition((pos) => {
              setWpLat(pos.coords.latitude);
              setWpLng(pos.coords.longitude);
          });
      }
      setShowWpModal(true);
  };

  const handleEditWaypoint = (wp: Waypoint) => {
      setEditingWaypoint(wp);
      setWpName(wp.name);
      setWpClue(wp.clue);
      setWpLat(wp.latitude);
      setWpLng(wp.longitude);
      setWpRadius(wp.radius);
      setShowWpModal(true);
  };

  const handleSaveWaypoint = () => {
      if (!currentHunt || !wpName || !wpClue) return;
      
      const newWp: Waypoint = {
          id: editingWaypoint ? editingWaypoint.id : uuidv4(),
          name: wpName,
          clue: wpClue,
          latitude: wpLat,
          longitude: wpLng,
          radius: wpRadius,
          order: editingWaypoint ? editingWaypoint.order : currentHunt.waypoints.length
      };

      let updatedWaypoints = [...currentHunt.waypoints];
      if (editingWaypoint) {
          updatedWaypoints = updatedWaypoints.map(w => w.id === editingWaypoint.id ? newWp : w);
      } else {
          updatedWaypoints.push(newWp);
      }

      setCurrentHunt({ ...currentHunt, waypoints: updatedWaypoints });
      setShowWpModal(false);
  };

  const handleDeleteWaypoint = (id: string) => {
      if (!currentHunt) return;
      const updated = currentHunt.waypoints.filter(w => w.id !== id);
      setCurrentHunt({ ...currentHunt, waypoints: updated });
  };

  const handleUseMyLocation = () => {
      if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition((pos) => {
              setWpLat(pos.coords.latitude);
              setWpLng(pos.coords.longitude);
          }, (err) => addToast("Could not get location. Ensure GPS is on.", 'error'));
      }
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
        <div className="h-full w-full bg-gray-950 flex flex-col text-white">
            <ConfirmationModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} onConfirm={handleDeleteHunt} title="Delete Hunt?" message="This cannot be undone." confirmText="Delete" isDanger={true} />
            
            <div className="p-4 border-b border-gray-800 flex items-center gap-4 bg-gray-900 sticky top-0 z-30">
                <button onClick={() => navigate('/')} className="p-2 bg-gray-800 rounded-full border border-gray-700 text-gray-400 hover:text-white"><ArrowLeft size={20}/></button>
                <div><h2 className="text-xl font-bold text-green-400">Scavenger Hunts</h2><p className="text-xs text-gray-500">GPS Adventures</p></div>
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
                                    <Map size={12}/> {hunt.waypoints.length} Stops • {hunt.gameMode === 'free_roam' ? 'Free Roam' : 'Sequential'}
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
        <div className="h-full w-full bg-gray-950 flex flex-col text-white">
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
                    <span>Progress</span>
                </div>
                <div className="space-y-2">
                    {participants.map((p, index) => {
                        const progress = Math.min(100, Math.round((p.completedCount / currentHunt.waypoints.length) * 100));
                        return (
                            <div key={p.id || index} className="bg-gray-900 border border-gray-800 p-3 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400"><User size={14}/></div>
                                <div className="flex-1">
                                    <div className="flex justify-between mb-1">
                                        <span className="font-bold text-white">{p.ign}</span>
                                        <span className="text-xs text-green-400">{p.completedCount}/{currentHunt.waypoints.length}</span>
                                    </div>
                                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${progress}%` }}></div>
                                    </div>
                                </div>
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
        {/* WAYPOINT MODAL */}
        <AnimatePresence>
            {showWpModal && (
                <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-gray-700 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-bold mb-4">{editingWaypoint ? 'Edit Checkpoint' : 'New Checkpoint'}</h3>
                        <div className="space-y-4">
                            <div><label className="text-xs text-gray-500 uppercase">Name</label><input className="w-full bg-gray-950 border border-gray-800 p-3" value={wpName} onChange={e => setWpName(e.target.value)} placeholder="e.g. Fountain"/></div>
                            <div><label className="text-xs text-gray-500 uppercase">Clue/Task</label><textarea className="w-full bg-gray-950 border border-gray-800 p-3" value={wpClue} onChange={e => setWpClue(e.target.value)} placeholder="Solve this riddle..."/></div>
                            <div className="flex gap-2">
                                <div className="flex-1"><label className="text-xs text-gray-500 uppercase">Lat</label><input type="number" className="w-full bg-gray-950 border border-gray-800 p-3" value={wpLat} onChange={e => setWpLat(parseFloat(e.target.value))}/></div>
                                <div className="flex-1"><label className="text-xs text-gray-500 uppercase">Lng</label><input type="number" className="w-full bg-gray-950 border border-gray-800 p-3" value={wpLng} onChange={e => setWpLng(parseFloat(e.target.value))}/></div>
                            </div>
                            <Button variant="secondary" onClick={handleUseMyLocation} className="text-xs h-8"><LocateFixed size={14}/> Use My GPS Location</Button>
                            <div><label className="text-xs text-gray-500 uppercase">Radius (meters)</label><input type="range" min="10" max="100" value={wpRadius} onChange={e => setWpRadius(parseInt(e.target.value))} className="w-full"/><div className="text-right text-xs text-gray-400">{wpRadius}m</div></div>
                            <div className="flex gap-2 mt-4">
                                <Button variant="secondary" fullWidth onClick={() => setShowWpModal(false)}>Cancel</Button>
                                <Button variant="primary" fullWidth onClick={handleSaveWaypoint}>Save</Button>
                            </div>
                        </div>
                    </div>
                </MotionDiv>
            )}
        </AnimatePresence>

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
                
                <div className="bg-gray-900 p-4 border border-gray-800">
                    <label className="text-xs text-gray-500 uppercase font-bold mb-3 block">Game Mode</label>
                    <div className="flex gap-2">
                        <button onClick={() => setHuntMode('sequential')} className={`flex-1 p-3  border text-sm font-bold transition-all ${huntMode === 'sequential' ? 'bg-green-600 border-green-500 text-white' : 'bg-gray-950 border-gray-800 text-gray-400'}`}>
                            <ListOrdered size={20} className="mx-auto mb-1"/> Sequential
                        </button>
                        <button onClick={() => setHuntMode('free_roam')} className={`flex-1 p-3  border text-sm font-bold transition-all ${huntMode === 'free_roam' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-950 border-gray-800 text-gray-400'}`}>
                            <Shuffle size={20} className="mx-auto mb-1"/> Free Roam
                        </button>
                    </div>
                </div>
            </div>

            <div className="border-t border-gray-800 pt-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-400 uppercase text-xs">Waypoints ({currentHunt?.waypoints.length || 0})</h3>
                    <Button variant="secondary" onClick={handleAddWaypoint} className="h-8 text-xs"><Plus size={14}/> Add Stop</Button>
                </div>
                
                <div className="space-y-2">
                    {currentHunt?.waypoints.map((wp, i) => (
                        <div key={wp.id || i} className="bg-gray-900 border border-gray-800 p-3 flex justify-between items-center group">
                            <div className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-500 border border-gray-700">{i+1}</div>
                                <div>
                                    <div className="font-bold text-sm text-white">{wp.name}</div>
                                    <div className="text-xs text-gray-500 truncate max-w-[150px]">{wp.clue}</div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleEditWaypoint(wp)} className="p-2 text-gray-500 hover:text-white"><Edit2 size={16}/></button>
                                <button onClick={() => handleDeleteWaypoint(wp.id)} className="p-2 text-gray-500 hover:text-red-400"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                    {(!currentHunt?.waypoints || currentHunt.waypoints.length === 0) && <div className="text-center text-gray-600 text-sm py-4">No checkpoints added yet.</div>}
                </div>
            </div>
        </div>
    </div>
  );
};
