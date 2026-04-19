
import React, { useState, useEffect, useRef } from 'react';
// @ts-ignore
import { useParams, useNavigate } from 'react-router-dom';
// @ts-ignore
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Button } from './Button';
import { Loader2, Navigation, Trophy, Compass, User, Gamepad2, Map as MapIcon, Box, ShieldCheck, Shield, Home } from 'lucide-react';
import { ScavengerHunt } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { PrivacyModal } from './PrivacyModal';
import { useToast } from './ToastContext';

const getDistanceFromLatLonInM = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

import { Footer } from './Footer';

export const ScavengerHuntLobby: React.FC = () => {
  const { huntId } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [hunt, setHunt] = useState<ScavengerHunt | null>(null);
  const [error, setError] = useState('');

  const [isRegistered, setIsRegistered] = useState(false);
  const [inputName, setInputName] = useState('');
  const [inputIgn, setInputIgn] = useState('');
  const [registering, setRegistering] = useState(false);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [hasAgreed, setHasAgreed] = useState(false);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [nearestWaypointId, setNearestWaypointId] = useState<string | null>(null);
  const [manualTargetId, setManualTargetId] = useState<string | null>(null);

  const [playerLat, setPlayerLat] = useState<number | null>(null);
  const [playerLng, setPlayerLng] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [gpsReady, setGpsReady] = useState(false);

  const watchIdRef = useRef<number | null>(null);

  const getDeviceId = () => {
      let id = localStorage.getItem('pogo_scavenger_device_id');
      if (!id) { id = uuidv4(); localStorage.setItem('pogo_scavenger_device_id', id); }
      return id;
  };

  useEffect(() => {
      const savedName = localStorage.getItem('pogo_saved_name');
      const savedIgn = localStorage.getItem('pogo_saved_ign');
      if (savedName) setInputName(savedName);
      if (savedIgn) setInputIgn(savedIgn);
  }, []);

  useEffect(() => {
      if (!huntId) return;
      const unsub = onSnapshot(doc(db, 'scavenger_hunts', huntId), (docSnap) => {
          if (!docSnap.exists()) { setError("Hunt not found."); setLoading(false); return; }
          const data = docSnap.data() as ScavengerHunt;
          if (!data.active) { setError("This hunt is currently inactive."); setLoading(false); return; }
          setHunt(data);
          setLoading(false);
      });
      const savedPid = localStorage.getItem(`pogo_scavenger_${huntId}_pid`);
      if (savedPid) { setParticipantId(savedPid); setIsRegistered(true); }
      setCompletedIds(JSON.parse(localStorage.getItem(`pogo_scavenger_${huntId}_completed`) || '[]'));
      setCurrentStepIndex(parseInt(localStorage.getItem(`pogo_scavenger_${huntId}_step`) || '0'));
      return () => unsub();
  }, [huntId]);

  useEffect(() => {
      if (!hunt) return;
      if (hunt.gameMode === 'free_roam') { if (completedIds.length >= hunt.waypoints.length) setIsComplete(true); }
      else { if (currentStepIndex >= hunt.waypoints.length) setIsComplete(true); }
  }, [hunt, completedIds, currentStepIndex]);

  useEffect(() => {
      if (!hasPermission || isComplete) return;
      if (navigator.geolocation) {
          watchIdRef.current = navigator.geolocation.watchPosition(
              (pos) => { setPlayerLat(pos.coords.latitude); setPlayerLng(pos.coords.longitude); setGpsReady(true); },
              () => {}, { enableHighAccuracy: true, maximumAge: 2000, timeout: 5000 }
          );
      }
      return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [hasPermission, isComplete]);

  useEffect(() => {
      if (!hunt || isComplete || playerLat === null || playerLng === null) return;
      if (hunt.gameMode === 'free_roam') {
          let minDist = Infinity; let closestId = null;
          hunt.waypoints.forEach(wp => {
              if (completedIds.includes(wp.id)) return;
              const dist = getDistanceFromLatLonInM(playerLat, playerLng, wp.latitude, wp.longitude);
              if (dist < minDist) { minDist = dist; closestId = wp.id; }
          });
          if (closestId) {
              setNearestWaypointId(closestId);
              const activeId = manualTargetId || closestId;
              const target = hunt.waypoints.find(w => w.id === activeId);
              if (target) setDistance(getDistanceFromLatLonInM(playerLat, playerLng, target.latitude, target.longitude));
          }
      } else {
          const target = hunt.waypoints[currentStepIndex];
          if (target) setDistance(getDistanceFromLatLonInM(playerLat, playerLng, target.latitude, target.longitude));
      }
  }, [playerLat, playerLng, hunt, currentStepIndex, completedIds, isComplete, manualTargetId]);

  const handleRegister = async () => {
      if (!inputName.trim() || !inputIgn.trim() || !huntId || !hasAgreed) return;
      setRegistering(true);
      try {
          const pid = getDeviceId();
          await setDoc(doc(db, `scavenger_hunts/${huntId}/participants/${pid}`), {
              id: pid, name: inputName.trim(), ign: inputIgn.trim(), joinedAt: Date.now(), completedCount: 0
          });
          localStorage.setItem(`pogo_scavenger_${huntId}_pid`, pid);
          setParticipantId(pid);
          setIsRegistered(true);
      } catch (e: any) {
          addToast("Error registering.", 'error');
      } finally { setRegistering(false); }
  };

  const handleSpinStop = async () => {
      if (!hunt || !distance || !huntId || !participantId) return;
      const target = hunt.gameMode === 'free_roam' ? hunt.waypoints.find(w => w.id === (manualTargetId || nearestWaypointId)) : hunt.waypoints[currentStepIndex];
      if (!target || distance > target.radius) return;
      setCheckingIn(true);
      setTimeout(async () => {
          let count = 0;
          if (hunt.gameMode === 'free_roam') {
              const next = [...completedIds, target.id];
              setCompletedIds(next);
              localStorage.setItem(`pogo_scavenger_${huntId}_completed`, JSON.stringify(next));
              count = next.length;
              setManualTargetId(null);
          } else {
              const nextIdx = currentStepIndex + 1;
              setCurrentStepIndex(nextIdx);
              localStorage.setItem(`pogo_scavenger_${huntId}_step`, nextIdx.toString());
              count = nextIdx;
          }
          await updateDoc(doc(db, `scavenger_hunts/${huntId}/participants/${participantId}`), { completedCount: count });
          setCheckingIn(false);
      }, 1500);
  };

  const handleGoCommunity = () => {
      navigate('/community', { state: { profile: hunt?.ambassador } });
  };

  if (loading) return <div className="h-[100dvh] bg-gray-950 flex items-center justify-center text-white"><Loader2 className="animate-spin text-green-500"/></div>;
  if (error) return <div className="h-[100dvh] bg-gray-950 flex flex-col items-center justify-center p-6 text-center text-white"><Shield className="text-red-500 mb-4" size={48}/><p className="text-gray-400 text-sm mb-6">{error}</p><Button onClick={() => window.location.reload()}>Retry</Button></div>;

  if (!hunt) return null;

  if (!isRegistered) {
      return (
          <div className="h-[100dvh] bg-gray-950 flex flex-col overflow-hidden">
            
            <div className="flex-1 overflow-y-auto flex flex-col items-center justify-start p-6 pt-12">
                <div className="w-full max-w-sm mx-auto">
                    <div className="flex justify-center mb-6">
                        <div className="w-20 h-20 bg-green-900/30 rounded-full flex items-center justify-center border-2 border-green-500">
                            <MapIcon className="text-green-400" size={32} />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-center mb-2">Join the Hunt</h1>
                    <p className="text-gray-400 text-center text-sm mb-8">Ready for an adventure?</p>
                    <div className="space-y-4 w-full">
                        <div>
                            <label className="text-xs text-gray-500 font-bold uppercase ml-1 mb-1 block">Trainer Name (IGN)</label>
                            <div className="relative">
                                <Gamepad2 className="absolute left-3 top-3.5 text-gray-600" size={18} />
                                <input 
                                    type="text" 
                                    value={inputIgn} 
                                    onChange={(e) => setInputIgn(e.target.value)} 
                                    className="w-full bg-gray-900 border border-gray-800 py-3 pl-10 pr-4 outline-none focus:border-green-500 placeholder-gray-700" 
                                    placeholder="Username" 
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 font-bold uppercase ml-1 mb-1 block">Your Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-3.5 text-gray-600" size={18} />
                                <input 
                                    type="text" 
                                    value={inputName} 
                                    onChange={(e) => setInputName(e.target.value)} 
                                    className="w-full bg-gray-900 border border-gray-800 py-3 pl-10 pr-4 outline-none focus:border-green-500 placeholder-gray-700" 
                                    placeholder="Nickname" 
                                />
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-gray-900/50 border border-gray-800 cursor-pointer" onClick={() => setHasAgreed(!hasAgreed)}>
                            <div className={`mt-0.5 shrink-0 w-5 h-5 border flex items-center justify-center ${hasAgreed ? 'bg-green-600 border-green-500' : 'border-gray-700'}`}>
                                {hasAgreed && <ShieldCheck size={14} className="text-white" />}
                            </div>
                            <p className="text-[10px] text-gray-400 leading-tight">
                                I agree to the collection of my Device ID and progress.
                            </p>
                        </div>
                        <Button fullWidth onClick={handleRegister} disabled={registering || !inputName || !inputIgn || !hasAgreed} className="bg-green-600 hover:bg-green-500 mt-2">
                            {registering ? <Loader2 className="animate-spin" /> : 'Start Adventure'}
                        </Button>
                    </div>
                </div>
            </div>
            
            <Footer />
        </div>
      )
  }

  if (isComplete) {
      return (
        <div className="h-[100dvh] bg-gray-950 flex flex-col items-center justify-center p-6 text-center text-white">
            <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-2xl animate-bounce">
                <Trophy size={48} className="text-black fill-current" />
            </div>
            <h1 className="text-4xl font-black mb-2 uppercase italic text-green-500">Mission Complete!</h1>
            <p className="text-gray-300 mb-8">You conquered <strong>{hunt.title}</strong>!</p>
            <Button variant="secondary" onClick={handleGoCommunity} className="flex items-center gap-2">
                <Home size={18}/> Return to Community
            </Button>
        </div>
      )
  }

  if (!hasPermission) return <div className="h-[100dvh] bg-gray-950 flex flex-col items-center justify-center text-white p-8 text-center"><div className="w-20 h-20 bg-blue-900/30 rounded-full flex items-center justify-center mb-6 animate-pulse"><Navigation size={40} className="text-blue-400" /></div><h1 className="text-2xl font-bold mb-2">GPS Access Required</h1><p className="text-gray-400 mb-8">We need your location to track progress.</p><Button fullWidth onClick={() => { navigator.geolocation.getCurrentPosition(() => setHasPermission(true)); }}>Enable GPS</Button></div>;

  const activeTarget = hunt.gameMode === 'free_roam' ? (hunt.waypoints.find(w => w.id === (manualTargetId || nearestWaypointId)) || hunt.waypoints.find(w => !completedIds.includes(w.id))) : hunt.waypoints[currentStepIndex];
  if (!activeTarget) return null;

  return (
    <div className="h-[100dvh] bg-gray-900 text-white flex flex-col overflow-hidden relative">
        <div className="absolute inset-0 z-0 opacity-20 bg-[radial-gradient(#ffffff33_1px,transparent_1px)] [background-size:20px_20px]" />
        
        {/* TOP BAR */}
        <div className="shrink-0 p-4 bg-gray-800/90 backdrop-blur-md border-b border-gray-700 flex justify-between items-center z-30 relative shadow-lg">
            <div><h2 className="font-bold text-sm text-white uppercase tracking-wider">{hunt.title}</h2><div className="text-[10px] text-gray-400 font-mono">{hunt.gameMode === 'free_roam' ? 'Free Roam' : `Checkpoint ${currentStepIndex + 1}/${hunt.waypoints.length}`}</div></div>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar max-w-[150px] p-1">{hunt.waypoints.map((wp, i) => <div key={i} className={`h-8 w-2 rounded-full border border-gray-700 ${completedIds.includes(wp.id) || (hunt.gameMode !== 'free_roam' && i < currentStepIndex) ? 'bg-purple-500' : wp.id === activeTarget.id ? 'bg-orange-500 scale-110' : 'bg-gray-600'}`} />)}</div>
        </div>

        {/* MIDDLE CONTENT (Map/Radar) */}
        <div className="flex-1 relative overflow-y-auto no-scrollbar z-10 flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center p-6 relative min-h-[400px]">
                <div className={`absolute top-6 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full border bg-gray-900/80 backdrop-blur-sm flex items-center gap-2 shadow-xl ${distance && distance <= activeTarget.radius ? 'border-green-500/50' : 'border-white/20'}`}><Compass size={14} className={gpsReady ? 'text-orange-500' : 'text-gray-500 animate-spin'}/><span className="font-mono font-bold text-lg">{gpsReady && distance !== null ? Math.round(distance) + 'm' : 'Searching...'}</span></div>
                <div className="relative cursor-pointer" onClick={distance && distance <= activeTarget.radius && !checkingIn ? handleSpinStop : undefined}>
                    <div className={`w-64 h-64 rounded-full border-8 shadow-2xl flex items-center justify-center transition-all duration-500 ${distance && distance <= activeTarget.radius ? 'border-white' : 'border-gray-600 opacity-80'} ${checkingIn ? 'animate-spin border-purple-400' : ''}`}><div className={`w-56 h-56 rounded-full overflow-hidden border-4 flex items-center justify-center ${checkingIn ? 'border-purple-500 bg-purple-900/50' : distance && distance <= activeTarget.radius ? 'border-blue-500 bg-blue-900/50' : 'border-gray-700 bg-gray-800'}`}>{distance && distance <= activeTarget.radius ? <MapIcon size={80} className="text-white opacity-20" /> : <Box size={80} className="text-blue-400 animate-pulse-slow" />}</div></div>
                    <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-64 text-center"><div className="bg-white text-gray-900 font-bold text-sm py-1 px-3 rounded-full shadow-lg inline-block truncate max-w-full border-2 border-gray-300">{activeTarget.name}</div></div>
                </div>
                <div className="absolute bottom-10 text-center w-full">{checkingIn ? <span className="text-purple-400 font-bold text-lg animate-pulse uppercase">Collecting...</span> : distance && distance <= activeTarget.radius ? <span className="text-white font-bold text-lg animate-bounce uppercase tracking-widest">Tap to Spin!</span> : <span className="text-gray-500 text-xs font-bold uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full">{gpsReady ? 'Too Far Away' : 'Acquiring GPS Signal...'}</span>}</div>
            </div>
        </div>

        {/* BOTTOM STICKY CARD */}
        <div className="shrink-0 p-4 pb-8 z-30 relative bg-gray-900 border-t border-gray-800">
            <div className="bg-white text-gray-900 p-5 shadow-2xl border-l-8 border-orange-500 relative min-h-[120px] flex items-center">
                <div className="w-full pr-8">
                    <h3 className="text-orange-600 font-bold text-xs uppercase mb-1 tracking-wider">Research Task</h3>
                    <p className="font-medium text-gray-800 text-sm italic">"{activeTarget.clue}"</p>
                </div>
            </div>
        </div>
        <Footer />
    </div>
  );
};
