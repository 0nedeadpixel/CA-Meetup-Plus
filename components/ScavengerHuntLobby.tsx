
import React, { useState, useEffect } from 'react';
// @ts-ignore
import { useParams, useNavigate } from 'react-router-dom';
// @ts-ignore
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Button } from './Button';
import { Loader2, Map as MapIcon, Gamepad2, User, ShieldCheck, Shield, Copy, Trophy, Home } from 'lucide-react';
import { ScavengerHunt, ScavengerParticipant } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { QRCodeSVG } from 'qrcode.react';
import { Footer } from './Footer';
import { useToast } from './ToastContext';

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
  const [participant, setParticipant] = useState<ScavengerParticipant | null>(null);
  const [hasAgreed, setHasAgreed] = useState(false);

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
      return () => unsub();
  }, [huntId]);

  useEffect(() => {
      const savedPid = localStorage.getItem(`pogo_scavenger_${huntId}_pid`);
      if (savedPid && huntId) {
          const unsub = onSnapshot(doc(db, `scavenger_hunts/${huntId}/participants/${savedPid}`), (docSnap) => {
              if (docSnap.exists()) {
                  setParticipant({ id: docSnap.id, ...docSnap.data() } as ScavengerParticipant);
                  setIsRegistered(true);
              }
          });
          return () => unsub();
      }
  }, [huntId]);

  const handleRegister = async () => {
      if (!inputName.trim() || !inputIgn.trim() || !huntId || !hasAgreed || !hunt) return;
      setRegistering(true);
      try {
          const pid = getDeviceId();
          let pool = [...(hunt.pokemonPool || [])];
          let targetsList = [...(hunt.targets || [])];
          
          let assignedPokemon: string[] = [];
          let assignedTargets: any[] = [];
          
          if (targetsList.length > 0) {
              assignedTargets = targetsList.sort(() => 0.5 - Math.random()).slice(0, 5).map(t => ({
                  ...t,
                  pokedexId: t.pokedexId || null // Sanitize undefined to null
              }));
              assignedPokemon = assignedTargets.map(t => t.name);
          } else if (pool.length > 0) {
              assignedPokemon = pool.sort(() => 0.5 - Math.random()).slice(0, 5);
              assignedTargets = assignedPokemon.map(p => ({ id: uuidv4(), name: p, pokedexId: null })); // Use null, not undefined
          }

          const newParticipant: ScavengerParticipant = {
              id: pid, 
              deviceId: pid,
              name: inputName.trim(), 
              ign: inputIgn.trim(), 
              joinedAt: Date.now(), 
              assignedPokemon: assignedPokemon,
              assignedTargets: assignedTargets,
              foundTargetIds: [],
              isVerified: false
          };
          
          await setDoc(doc(db, `scavenger_hunts/${huntId}/participants/${pid}`), newParticipant);
          localStorage.setItem(`pogo_scavenger_${huntId}_pid`, pid);
          setParticipant(newParticipant);
          setIsRegistered(true);
      } catch (e: any) {
          setError("Failed to register.");
      } finally { setRegistering(false); }
  };

  const toggleFound = async (targetId: string) => {
      if (!participant || !huntId) return;
      const currentFound = participant.foundTargetIds || [];
      const isFound = currentFound.includes(targetId);
      
      const newFound = isFound 
          ? currentFound.filter(id => id !== targetId)
          : [...currentFound, targetId];
          
      // Optimistic update
      setParticipant({ ...participant, foundTargetIds: newFound });
      
      // Save to Firebase
      try {
          await setDoc(doc(db, `scavenger_hunts/${huntId}/participants/${participant.id}`), {
              foundTargetIds: newFound
          }, { merge: true });
      } catch (err) {
          console.error('Failed to save found state', err);
          setParticipant({ ...participant, foundTargetIds: currentFound }); // revert on error
          addToast("Failed to update status", "error");
      }
  };

  const handleSearchStringCopy = () => {
      if (!participant || !participant.assignedPokemon || participant.assignedPokemon.length === 0) return;
      const searchString = `age0 & ${participant.assignedPokemon.join(',')}`;
      navigator.clipboard.writeText(searchString);
      addToast("Search string copied to clipboard!", "success");
  };

  const handleGoCommunity = () => {
      navigate('/community', { state: { profile: hunt?.ambassador } });
  };

  if (loading) return <div className="h-[100dvh] bg-gray-950 flex items-center justify-center text-white"><Loader2 className="animate-spin text-green-500"/></div>;
  if (error) return <div className="h-[100dvh] bg-gray-950 flex flex-col items-center justify-center p-6 text-center text-white"><Shield className="text-red-500 mb-4" size={48}/><p className="text-gray-400 text-sm mb-6">{error}</p><Button onClick={() => window.location.reload()}>Retry</Button></div>;

  if (!hunt) return null;

  if (isRegistered && participant?.isVerified) {
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

  if (!isRegistered || !participant) {
      return (
          <div className="h-[100dvh] bg-gray-950 flex flex-col overflow-hidden text-white">
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
                                I agree to participate in this hunt event.
                            </p>
                        </div>
                        <Button fullWidth onClick={handleRegister} disabled={registering || !inputName || !inputIgn || !hasAgreed} className="bg-green-600 hover:bg-green-500 mt-2 border-none">
                            {registering ? <Loader2 className="animate-spin" /> : 'Start Adventure'}
                        </Button>
                    </div>
                </div>
            </div>
            
            <Footer />
        </div>
      )
  }

  // Generate Admin Verification QR Code Value
  let baseUrl = window.location.origin + window.location.pathname;
  if (baseUrl.endsWith('/')) { baseUrl = baseUrl.slice(0, -1); }
  const verifyUrl = `${baseUrl}/#/scavenger?hunt=${huntId}&verify=${participant.id}`;

  return (
    <div className="h-[100dvh] bg-gray-900 text-white flex flex-col overflow-hidden relative">
        <div className="absolute inset-0 z-0 opacity-20 bg-[radial-gradient(#ffffff33_1px,transparent_1px)] [background-size:20px_20px]" />
        
        {/* TOP BAR */}
        <div className="shrink-0 p-4 bg-gray-800/90 backdrop-blur-md border-b border-gray-700 flex justify-between items-center z-30 relative shadow-lg">
            <div><h2 className="font-bold text-sm text-white uppercase tracking-wider">{hunt.title}</h2><div className="text-[10px] text-gray-400 font-mono">Catch-List</div></div>
            <div className={`text-xs font-bold px-3 py-1 rounded-full ${participant.isVerified ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-gray-700 text-gray-400'}`}>
                {participant.isVerified ? 'Verified' : 'In Progress'}
            </div>
        </div>

        {/* MIDDLE CONTENT */}
        <div className="flex-1 relative overflow-y-auto z-10 flex flex-col p-6">
            <h3 className="text-xl font-bold mb-2">Your Catch-List</h3>
            <p className="text-sm text-gray-400 mb-6">Catch all of the following Pokémon during the event. Use the search string below to filter your storage!</p>

            {/* Retro 3-Column Target Grid */}
            <div className="w-full max-w-md mx-auto p-4">
              <div className="grid grid-cols-3 gap-3">
                {participant.assignedTargets?.map((target) => {
                  const isFound = participant.foundTargetIds?.includes(target.id) || false;
                  return (
                    <div 
                      key={target.id} 
                      onClick={() => toggleFound(target.id)}
                      className={`relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-300 cursor-pointer ${
                        isFound 
                          ? 'bg-gray-900 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.2)]' 
                          : 'bg-gray-800 border-gray-700 hover:border-gray-500'
                      }`}
                    >
                      {/* Retro Pixel Sprite - Fallback to Pokéball if Dex ID is missing */}
                      <img 
                        src={target.pokedexId 
                          ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-i/red-blue/transparent/${target.pokedexId}.png`
                          : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png`
                        }
                        alt={target.name}
                        className={`w-24 h-24 drop-shadow-lg transition-all duration-300 ${
                          isFound ? 'opacity-30 scale-95' : 'opacity-100 scale-100'
                        }`}
                        style={{ imageRendering: 'pixelated' }}
                      />
                      
                      {/* Dex Number & Name (Always Visible) */}
                      <div className="mt-2 flex flex-col items-center w-full">
                        <span className="text-[10px] text-gray-500 font-mono tracking-widest">
                          {target.pokedexId ? `#${String(target.pokedexId).padStart(3, '0')}` : '???'}
                        </span>
                        <span className={`text-xs font-black uppercase tracking-wider truncate w-full text-center mt-0.5 ${
                          isFound ? 'text-purple-400 line-through' : 'text-white'
                        }`}>
                          {target.name}
                        </span>
                      </div>

                      {/* Found Badge */}
                      {isFound && (
                        <div className="absolute -top-2 -right-2 bg-purple-500 text-white rounded-full p-1 border-2 border-gray-950 shadow-lg">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-gray-950 border border-gray-800 p-4 rounded mb-6 flex flex-col items-center mt-6">
                <Button variant="secondary" onClick={handleSearchStringCopy} fullWidth className="text-sm border-gray-700 gap-2 h-10">
                    <Copy size={16} /> Copy Search String
                </Button>
            </div>

            <div className="bg-gray-800 border border-gray-700 p-6 rounded text-center shadow-2xl mt-auto">
                <h4 className="text-lg font-bold mb-2">Verification Code</h4>
                <p className="text-xs text-gray-400 mb-6">Show this QR code to the Ambassador once you have completed your catch-list.</p>
                <div className="bg-white p-4 inline-block rounded max-w-full">
                    <QRCodeSVG value={verifyUrl} size={200} />
                </div>
            </div>
        </div>

        <Footer />
    </div>
  );
};
