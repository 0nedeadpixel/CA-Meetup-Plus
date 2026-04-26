
import React, { useState, useEffect } from 'react';
// @ts-ignore
import { useParams, useNavigate } from 'react-router-dom';
// @ts-ignore
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Button } from './Button';
import { Loader2, MapIcon, Gamepad2, User, ShieldCheck, Shield, Copy, Trophy, Home } from 'lucide-react';
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
          
          // Randomly shuffle and take up to 5
          pool = pool.sort(() => 0.5 - Math.random()).slice(0, 5);
          
          const newParticipant: ScavengerParticipant = {
              id: pid, 
              deviceId: pid,
              name: inputName.trim(), 
              ign: inputIgn.trim(), 
              joinedAt: Date.now(), 
              assignedPokemon: pool,
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

            <div className="bg-gray-950 border border-gray-800 p-4 rounded mb-6">
                <h4 className="text-xs uppercase text-gray-500 font-bold mb-2">Assigned Pokémon</h4>
                <div className="flex flex-wrap gap-2 mb-4">
                    {participant.assignedPokemon?.map((poke, i) => (
                        <span key={i} className="bg-gray-900 border border-gray-700 px-3 py-1 rounded text-sm text-white">{poke}</span>
                    ))}
                    {(!participant.assignedPokemon || participant.assignedPokemon.length === 0) && <span className="text-sm text-gray-500">No Pokémon assigned.</span>}
                </div>

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
