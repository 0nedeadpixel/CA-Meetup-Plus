// ... existing imports ...
import React, { useState, useEffect } from 'react';
// @ts-ignore
import { useParams, useNavigate } from 'react-router-dom';
// @ts-ignore
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp, increment, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { Button } from './Button';
import { Loader2, BrainCircuit, User, XCircle, CheckCircle, Trophy, ShieldCheck, Shield, Clock, Lock, Zap, Flame, Home, ArrowRight, Play, Eye, RotateCcw, ArrowLeft, Share2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { TriviaSession, TriviaPlayer, TriviaQuestion } from '../types';
import { PrivacyModal } from './PrivacyModal';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useToast } from './ToastContext';
// @ts-ignore
import html2canvas from 'html2canvas';

// Fix for framer-motion type mismatch
const MotionDiv = motion.div as any;

// Helper to match Host colors
const getAdaptiveColor = (text: string, index: number) => {
    const t = text.toLowerCase();
    if (t.includes('red')) return { bg: 'bg-red-600', border: 'border-red-800' };
    if (t.includes('blue')) return { bg: 'bg-blue-600', border: 'border-blue-800' };
    if (t.includes('green')) return { bg: 'bg-green-600', border: 'border-green-800' };
    if (t.includes('yellow')) return { bg: 'bg-yellow-500', border: 'border-yellow-700' };
    if (t.includes('purple')) return { bg: 'bg-purple-600', border: 'border-purple-800' };
    if (t.includes('orange')) return { bg: 'bg-orange-500', border: 'border-orange-700' };
    if (t.includes('pink')) return { bg: 'bg-pink-500', border: 'border-pink-700' };
    if (t.includes('black')) return { bg: 'bg-gray-900', border: 'border-black' };
    if (t.includes('white')) return { bg: 'bg-gray-100', border: 'border-gray-400', text: 'text-black' };
    
    // Defaults
    const defaults = [
        { bg: 'bg-red-500', border: 'border-red-700' },
        { bg: 'bg-blue-500', border: 'border-blue-700' },
        { bg: 'bg-yellow-500', border: 'border-yellow-700', text: 'text-black' },
        { bg: 'bg-green-500', border: 'border-green-700' }
    ];
    return defaults[index % 4];
};

import { Footer } from './Footer';

export const TriviaLobby: React.FC = () => {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [name, setName] = useState(localStorage.getItem('pogo_saved_ign') || '');
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [session, setSession] = useState<TriviaSession | null>(null);
    const [myPlayer, setMyPlayer] = useState<TriviaPlayer | null>(null);
    const [joining, setJoining] = useState(false);
    const [hasAnswered, setHasAnswered] = useState(false);
    const [hasAgreed, setHasAgreed] = useState(false);

    // SELF-PACED STATE
    const [localTimer, setLocalTimer] = useState(0);
    const [localQuestionIndex, setLocalQuestionIndex] = useState(0);
    const [localGameState, setLocalGameState] = useState<'INTRO' | 'QUESTION' | 'RESULT' | 'FINISHED' | 'REVIEW'>('INTRO');
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [isCorrectLocal, setIsCorrectLocal] = useState<boolean | null>(null);
    
    // SHARE CARD STATE
    const [generatingImage, setGeneratingImage] = useState(false);

    const getDeviceId = () => {
        let id = localStorage.getItem('pogo_trivia_device_id');
        if (!id) { id = uuidv4(); localStorage.setItem('pogo_trivia_device_id', id); }
        return id;
    };

    // 1. SYNC SESSION
    useEffect(() => {
        if (!sessionId) return;
        const unsub = onSnapshot(doc(db, 'trivia_sessions', sessionId), (snap: any) => {
            if (snap.exists()) {
                setSession(snap.data() as TriviaSession);
            } else {
                setSession((prev) => prev ? { ...prev, active: false, status: 'FINISHED' } : null);
            }
        });
        return () => unsub();
    }, [sessionId]);

    // 2. SYNC PLAYER (ONE ATTEMPT CHECK)
    useEffect(() => {
        if (!sessionId) return;
        
        // Always derive ID from device first to check if they already joined
        const pid = getDeviceId();
        setPlayerId(pid);

        const unsub = onSnapshot(doc(db, `trivia_sessions/${sessionId}/players/${pid}`), (snap: any) => {
            if (snap.exists()) {
                const data = snap.data();
                const p = { id: snap.id, ...(data as any) } as TriviaPlayer;
                setMyPlayer(p);
                
                // LIVE MODE SYNC
                if (session && session.mode !== 'SELF_PACED') {
                    if (p.lastAnswerIndex === null) setHasAnswered(false);
                    // Haptics
                    if (p.isCorrect === true && session.status === 'REVEAL') {
                        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 }, colors: ['#4ade80', '#ffffff'] });
                        if(navigator.vibrate) navigator.vibrate([50, 50, 50]);
                    }
                    if (p.isCorrect === false && session.status === 'REVEAL') {
                        if(navigator.vibrate) navigator.vibrate(300);
                    }
                } else {
                    // SELF PACED SYNC (Restore Progress)
                    if (p.currentQuestionIndex !== undefined) {
                        // Only sync index if we are not in REVIEW mode (prevents jumping around while reviewing)
                        if (localGameState !== 'REVIEW') {
                            setLocalQuestionIndex(p.currentQuestionIndex);
                        }
                        
                        // If they are finished, force FINISHED state (prevents replay)
                        if (p.status === 'FINISHED' && localGameState !== 'REVIEW') {
                            setLocalGameState('FINISHED');
                        }
                    }
                }
            } else {
                setMyPlayer(null); // Not joined yet
            }
        });
        return () => unsub();
    }, [sessionId, session?.status, session?.mode]);

    // 3. SELF-PACED TIMER
    useEffect(() => {
        let interval: any;
        if (localGameState === 'QUESTION' && localTimer > 0) {
            interval = setInterval(() => {
                setLocalTimer(prev => prev - 1);
            }, 1000);
        } else if (localGameState === 'QUESTION' && localTimer === 0) {
            handleSelfPacedSubmit(-1); // Time's up
        }
        return () => clearInterval(interval);
    }, [localGameState, localTimer]);

    const handleJoin = async () => {
        if (!name.trim() || !sessionId || !hasAgreed) return;
        setJoining(true);
        localStorage.setItem('pogo_saved_ign', name.trim());
        const pid = getDeviceId();
        try {
            await setDoc(doc(db, `trivia_sessions/${sessionId}/players/${pid}`), {
                id: pid, deviceId: pid, name: name.trim(), score: 0, streak: 0, 
                lastAnswerIndex: null, lastAnswerTime: null, isCorrect: null,
                currentQuestionIndex: 0, status: 'PLAYING', correctAnswersCount: 0,
                answerHistory: []
            });
            setPlayerId(pid);
        } catch (e) { addToast("Error joining.", 'error'); }
        finally { setJoining(false); }
    };

    // --- LIVE HANDLERS ---
    const handleLiveAnswer = async (index: number) => {
        if (!sessionId || !playerId || hasAnswered) return;
        if (navigator.vibrate) navigator.vibrate(50);
        setHasAnswered(true);
        await updateDoc(doc(db, `trivia_sessions/${sessionId}/players/${playerId}`), { lastAnswerIndex: index, lastAnswerTime: Date.now() });
    };

    // --- SELF PACED HANDLERS ---
    const startSelfPaced = () => {
        if (!session) return;
        const q = session.questions[localQuestionIndex];
        if (!q) {
            setLocalGameState('FINISHED');
            return;
        }
        setLocalTimer(q.timeLimit);
        setLocalGameState('QUESTION');
        setSelectedAnswer(null);
        setIsCorrectLocal(null);
    };

    const handleSelfPacedSubmit = async (answerIndex: number) => {
        if (!session || !playerId || localGameState !== 'QUESTION') return;
        
        setSelectedAnswer(answerIndex);
        setLocalGameState('RESULT');
        
        const q = session.questions[localQuestionIndex];
        const isCorrect = answerIndex === q.correctIndex;
        setIsCorrectLocal(isCorrect);

        // Calc Score
        let points = 0;
        let newStreak = (myPlayer?.streak || 0);

        if (isCorrect) {
            points = 1000;
            newStreak += 1;
            
            // Time bonus
            const timeTaken = q.timeLimit - localTimer;
            const ratio = Math.min(1, timeTaken / q.timeLimit);
            // NEW: Up to 1000 bonus for time
            points += Math.floor(1000 * (1 - ratio));
            
            // NEW: Streak Bonus (Scaling)
            // 100 per streak, max 500
            if (newStreak >= 2) {
                points += Math.min(newStreak * 100, 500);
            }
            
            confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 }, colors: ['#4ade80', '#ffffff'] });
            if(navigator.vibrate) navigator.vibrate([50, 50, 50]);
        } else {
            newStreak = 0;
            if(navigator.vibrate) navigator.vibrate(300);
        }

        // Update DB
        const updatePayload: any = {
            score: (myPlayer?.score || 0) + points,
            streak: newStreak,
            answerHistory: arrayUnion({
                questionIndex: localQuestionIndex,
                selectedOption: answerIndex,
                isCorrect: isCorrect,
                timeTaken: q.timeLimit - localTimer
            })
        };
        
        if (isCorrect) {
            updatePayload.correctAnswersCount = increment(1);
        }

        await updateDoc(doc(db, `trivia_sessions/${sessionId}/players/${playerId}`), updatePayload);
    };

    const nextSelfPacedQuestion = async () => {
        if (!session || !playerId) return;
        const nextIdx = localQuestionIndex + 1;
        
        if (nextIdx >= session.questions.length) {
            // End Game
            setLocalGameState('FINISHED');
            await updateDoc(doc(db, `trivia_sessions/${sessionId}/players/${playerId}`), {
                currentQuestionIndex: nextIdx,
                status: 'FINISHED'
            });
        } else {
            // Next Question
            const nextQ = session.questions[nextIdx];

            // 1. UPDATE UI STATE INSTANTLY (Prevents flashing of previous result colors on new question)
            setLocalQuestionIndex(nextIdx);
            setLocalTimer(nextQ.timeLimit);
            setLocalGameState('QUESTION');
            setSelectedAnswer(null);
            setIsCorrectLocal(null);

            // 2. Sync to DB in background
            await updateDoc(doc(db, `trivia_sessions/${sessionId}/players/${playerId}`), {
                currentQuestionIndex: nextIdx
            });
        }
    };

    const handleLeave = () => {
        navigate('/community', { state: { profile: session?.ambassador } });
    };

    const handleShareScore = async () => {
        const el = document.getElementById('share-card');
        if (!el) return;
        setGeneratingImage(true);
        try {
            // Force a small delay to ensure images render
            await new Promise(resolve => setTimeout(resolve, 500));

            // Use 1x scale because we are designing it at strict 1080x1920 resolution in DOM
            const canvas = await html2canvas(el, { 
                scale: 1, 
                useCORS: true, 
                backgroundColor: '#111827', // Dark fallback
                allowTaint: true,
                logging: false, // Prevents html2canvas from throwing "Converting circular structure to JSON" internally on image load errors
                ignoreElements: (element) => {
                    // Help html2canvas skip anything it shouldn't touch
                    return false;
                }
            });
            canvas.toBlob(async (blob: Blob | null) => {
                if (!blob) return;
                const file = new File([blob], "trivia-result.png", { type: "image/png" });
                
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    try {
                        await navigator.share({
                            files: [file],
                            title: 'Pokemon Trivia Master',
                            text: `Hey! Check out my Pokemon Trivia, I think I'm on my way to become a Pokemon Master with this score! Can you beat my score?`
                        });
                    } catch (e) {
                        // If share fails, fallback to download
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a'); a.href = url; a.download = "trivia-result.png"; a.click();
                    }
                } else {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = "trivia-result.png"; a.click();
                }
            });
        } catch (e) {
            console.error("Share failed", e);
            addToast("Could not generate image. Please screenshot manually.", 'error');
        } finally {
            setGeneratingImage(false);
        }
    };

    // --- UI STATES ---

    if (!session) return <div className="h-[100dvh] bg-gray-950 flex items-center justify-center text-white"><Loader2 className="animate-spin text-blue-500"/></div>;

    // LOGIN SCREEN (Only if player record doesn't exist)
    if (!myPlayer) {
        const isExpired = session.expiresAt && Date.now() > session.expiresAt;
        if (isExpired) return (
            <div className="h-[100dvh] bg-gray-950 flex flex-col items-center justify-center p-6 text-center text-white">
                <Clock size={48} className="text-gray-600 mb-4"/>
                <h1 className="text-2xl font-bold mb-2">Session Expired</h1>
                <p className="text-gray-400">This self-paced challenge has ended.</p>
                <Button variant="secondary" onClick={handleLeave} className="mt-6">Return Home</Button>
            </div>
        );

        return (
            <div className="h-[100dvh] bg-gray-950 flex flex-col overflow-hidden relative">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-gray-950 to-black pointer-events-none" />

                <div className="flex-1 overflow-y-auto flex flex-col items-center justify-start p-6 pt-12 relative z-10">
                    <div className="w-full max-w-sm mx-auto">
                        <MotionDiv initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-24 h-24 bg-blue-900/30 rounded-full flex items-center justify-center mb-8 animate-pulse mx-auto border-4 border-blue-500/20">
                            <BrainCircuit size={48} className="text-blue-400" />
                        </MotionDiv>
                        <h1 className="text-3xl font-black mb-2 text-center text-white">{session.title || 'TRIVIA'}</h1>
                        <p className="text-gray-400 mb-8 text-sm text-center font-medium">
                            {session.mode === 'SELF_PACED' ? 'Self-Paced Challenge' : 'Join the live game!'}
                        </p>
                        
                        {session.mode === 'SELF_PACED' && session.expiresAt && (
                            <div className="bg-gray-900 border border-gray-800 p-3 mb-6 flex items-center justify-center gap-2 text-xs text-gray-400">
                                <Clock size={14}/> Ends: {new Date(session.expiresAt).toLocaleString()}
                            </div>
                        )}

                        <div className="w-full space-y-4">
                            <div className="relative">
                                <User className="absolute left-3 top-3.5 text-gray-500" size={18} />
                                <input 
                                    type="text" 
                                    value={name} 
                                    onChange={(e) => setName(e.target.value)} 
                                    className="w-full bg-gray-900 border border-gray-700 py-3 pl-10 pr-4 outline-none focus:border-blue-500 placeholder-gray-600 text-white font-bold" 
                                    placeholder="Enter Nickname" 
                                    maxLength={16} 
                                />
                            </div>
                            <div className="flex items-start gap-3 p-3 bg-gray-900/50 border border-gray-800 cursor-pointer" onClick={() => setHasAgreed(!hasAgreed)}>
                                <div className={`mt-0.5 shrink-0 w-5 h-5 border flex items-center justify-center transition-colors ${hasAgreed ? 'bg-blue-600 border-blue-500' : 'border-gray-700'}`}>{hasAgreed && <ShieldCheck size={14} className="text-white" />}</div>
                                <p className="text-[10px] text-gray-400 leading-tight">I agree to play nicely and share my score data.</p>
                            </div>
                            <Button className="bg-blue-600 hover:bg-blue-500 w-full mt-4 h-14 text-lg shadow-lg shadow-blue-900/20" onClick={handleJoin} disabled={joining || !name.trim() || !hasAgreed}>
                                {joining ? <Loader2 className="animate-spin"/> : (session.mode === 'SELF_PACED' ? 'Start Quiz' : 'Join Lobby')}
                            </Button>
                        </div>
                    </div>
                </div>

                <Footer />
            </div>
        );
    }

    // --- SELF PACED GAME ---
    if (session.mode === 'SELF_PACED') {
        const isExpired = session.expiresAt && Date.now() > session.expiresAt;
        
        // REVIEW SCREEN
        if (localGameState === 'REVIEW') {
            return (
                <div className="h-[100dvh] bg-gray-950 flex flex-col text-white">
                    <div className="p-4 border-b border-gray-800 bg-gray-900 flex items-center gap-4">
                        <button onClick={() => setLocalGameState('FINISHED')} className="p-2 bg-gray-800 rounded-full border border-gray-700 text-gray-400 hover:text-white"><ArrowLeft size={20}/></button>
                        <h2 className="text-lg font-bold">Review Answers</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {session.questions.map((q, i) => {
                            // Find player answer for this question
                            const ans = myPlayer?.answerHistory?.find(a => a.questionIndex === i);
                            const wasCorrect = ans?.isCorrect;
                            const userChoice = ans?.selectedOption;
                            
                            return (
                                <div key={q.id} className="bg-gray-900 border border-gray-800 p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-sm text-gray-200 pr-4">{i+1}. {q.text}</h3>
                                        {wasCorrect !== undefined && (
                                            wasCorrect ? <CheckCircle size={20} className="text-green-500 shrink-0"/> : <XCircle size={20} className="text-red-500 shrink-0"/>
                                        )}
                                    </div>
                                    <div className="space-y-1 mt-2">
                                        {q.options.map((opt, optIdx) => {
                                            const isCorrectAnswer = optIdx === q.correctIndex;
                                            const isUserChoice = userChoice === optIdx;
                                            
                                            let style = "text-xs p-2  border ";
                                            if (isCorrectAnswer) style += "bg-green-900/20 border-green-500/50 text-green-300 font-bold";
                                            else if (isUserChoice && !wasCorrect) style += "bg-red-900/20 border-red-500/50 text-red-300";
                                            else style += "bg-gray-950 border-gray-800 text-gray-500";

                                            return (
                                                <div key={optIdx} className={style}>
                                                    {opt} {isUserChoice && "(You)"}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )
        }

        // FINISHED SCREEN
        if (localGameState === 'FINISHED' || isExpired) {
            const hasShareCard = session.shareConfig?.enabled;
            return (
                <div className="h-[100dvh] bg-gray-950 p-6 flex flex-col items-center justify-center text-white text-center relative overflow-hidden">
                    
                    {/* HIDDEN SHARE CARD DOM (NATIVE 1080x1920) */}
                    {hasShareCard && (
                        <div id="share-card" className="absolute top-0 left-[-9999px] w-[1080px] h-[1920px] bg-gray-950 flex flex-col items-center font-sans text-white overflow-hidden">
                            {/* 1. Background Image - Explicit IMG tag works better with html2canvas than CSS background */}
                            <img 
                                src="https://fullertonpogo.com/go-tour-global-image.jpg" 
                                className="absolute inset-0 w-full h-full object-cover z-0" 
                                crossOrigin="anonymous" 
                                alt="Background"
                            />
                            
                            {/* Dark Overlay for readability */}
                            <div className="absolute inset-0 bg-black/50 z-0" />

                            {/* 2. Professor Willow - Foreground */}
                            <img 
                                src="https://fullertonpogo.com/prof-willow.png" 
                                className="absolute bottom-[-50px] right-[-200px] w-[1100px] h-auto object-contain z-10"
                                crossOrigin="anonymous"
                                alt="Professor Willow"
                            />

                            {/* 3. Content */}
                            <div className="relative z-20 flex flex-col items-center pt-32 w-full px-12">
                                {/* Logo */}
                                <div className="w-40 h-40 bg-white rounded-full p-2 mb-6 shadow-2xl overflow-hidden flex items-center justify-center border-4 border-white/20 backdrop-blur-md">
                                     {session.ambassador?.groupLogo ? (
                                        <img src={session.ambassador.groupLogo} className="w-full h-full object-cover rounded-full" crossOrigin="anonymous"/>
                                    ) : (
                                        <Trophy size={80} className="text-black"/>
                                    )}
                                </div>

                                <h2 className="text-3xl font-bold uppercase tracking-[0.3em] mb-2 text-white/90 drop-shadow-md text-center">{session.ambassador?.communityName || 'Fullerton GO!'}</h2>
                                <h1 className="text-7xl font-black uppercase mb-12 text-white drop-shadow-xl text-center leading-tight">
                                    {myPlayer?.status === 'FINISHED' ? 'MISSION REPORT' : 'QUIZ RESULT'}
                                </h1>

                                {/* Score Box */}
                                <div className="bg-gray-900/80 backdrop-blur-xl border border-white/20 p-10 w-full shadow-2xl flex flex-col items-center mb-12 relative overflow-hidden max-w-[800px]">
                                    <div className="text-3xl font-bold text-gray-400 uppercase tracking-widest mb-4">Total Score</div>
                                    <div className="text-[11rem] leading-none font-black text-white drop-shadow-2xl mb-6 tracking-tighter">
                                        {myPlayer?.score || 0}
                                    </div>
                                    <div className="bg-white/10 px-8 py-4 rounded-full border border-white/10 flex items-center gap-4 text-3xl font-bold text-white">
                                        <CheckCircle size={40} className="text-green-400" />
                                        <span>{myPlayer?.correctAnswersCount || 0} / {session.questions.length} Correct</span>
                                    </div>
                                </div>

                                {/* Player Name */}
                                <div className="text-center bg-black/40 px-12 py-6 backdrop-blur-sm border border-white/10">
                                    <div className="text-6xl font-bold text-white drop-shadow-md mb-2">{name}</div>
                                    <div className="text-2xl text-yellow-400 font-bold uppercase tracking-widest">Pokemon Master</div>
                                </div>
                            </div>

                            {/* 4. Footer */}
                            <div className="absolute bottom-12 left-12 z-30">
                                 <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md px-8 py-4 rounded-full border border-white/20">
                                    <div className="text-left">
                                        <p className="text-xl text-white/80 uppercase tracking-wider font-bold text-xs">Play at</p>
                                        <p className="text-2xl font-bold text-white">cameetup.net</p>
                                    </div>
                                 </div>
                            </div>
                        </div>
                    )}

                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-gray-950 to-black pointer-events-none" />
                    <div className="w-24 h-24 bg-gray-900 rounded-full flex items-center justify-center mb-6 border-4 border-gray-800 shadow-xl relative animate-pulse z-10">
                        <Trophy size={48} className="text-yellow-400"/>
                    </div>
                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-2 uppercase italic z-10 relative">
                        COMPLETE!
                    </h1>
                    <div className="bg-gray-900/80 p-6 border border-yellow-500/30 w-full max-w-xs mb-8 shadow-lg z-10 relative">
                        <div className="text-[10px] text-yellow-500 uppercase font-bold tracking-widest mb-2">Final Score</div>
                        <div className="text-5xl font-black text-white mb-1">{myPlayer?.score || 0}</div>
                        {myPlayer?.correctAnswersCount !== undefined && (
                            <div className="text-xs text-gray-400 mt-2">
                                {myPlayer.correctAnswersCount} / {session.questions.length} Correct
                            </div>
                        )}
                    </div>
                    
                    <div className="z-10 relative flex flex-col gap-3 w-full max-w-xs">
                        {hasShareCard && (
                            <Button variant="purple" onClick={handleShareScore} disabled={generatingImage} className="h-12 text-sm flex items-center gap-2 mb-2">
                                {generatingImage ? <Loader2 className="animate-spin" size={16}/> : <Share2 size={16}/>} Share Result
                            </Button>
                        )}
                        <Button variant="primary" onClick={() => setLocalGameState('REVIEW')} className="h-12 text-sm flex items-center gap-2">
                            <Eye size={16}/> Review Answers
                        </Button>
                        <Button variant="secondary" onClick={handleLeave} className="h-12 text-sm flex items-center gap-2">
                            <Home size={16}/> Return to Community
                        </Button>
                    </div>
                </div>
            )
        }

        // INTRO SCREEN
        if (localGameState === 'INTRO') {
            return (
                <div className="h-[100dvh] bg-gray-950 p-6 flex flex-col items-center justify-center text-white text-center">
                    <h2 className="text-xl font-bold mb-4">Ready {name}?</h2>
                    <p className="text-gray-400 mb-8 max-w-xs text-sm">
                        You have {session.questions.length} questions. 
                        The timer starts as soon as you tap below.
                    </p>
                    <Button onClick={startSelfPaced} icon={<Play size={20} fill="currentColor"/>} className="w-full max-w-xs h-16 text-lg">
                        Let's Go!
                    </Button>
                </div>
            )
        }

        // QUESTION / RESULT SCREEN
        const currentQ = session.questions[localQuestionIndex];
        return (
            <div className="h-[100dvh] bg-gray-950 flex flex-col overflow-hidden relative">
                {/* Header */}
                <div className="shrink-0 flex justify-between items-end mb-4 border-b border-gray-800 pb-4 p-6 bg-gray-900/80 backdrop-blur-md z-20">
                    <div>
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Question</span>
                        <div className="text-2xl font-black text-white leading-none">
                            {localQuestionIndex + 1}<span className="text-lg text-gray-600">/{session.questions.length}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className={`text-2xl font-black font-mono ${localTimer <= 5 && localGameState === 'QUESTION' ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                            {localTimer}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col max-w-md mx-auto w-full relative z-10">
                    <AnimatePresence mode="wait">
                        <MotionDiv 
                            key={currentQ.id} 
                            initial={{ y: 20, opacity: 0 }} 
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -20, opacity: 0 }}
                            className="w-full"
                        >
                            <div className="bg-white text-gray-900 p-6 shadow-lg mb-6 min-h-[140px] flex items-center justify-center shrink-0 border-b-8 border-gray-200">
                                 <h2 className="text-xl md:text-2xl font-black text-center leading-tight">{currentQ.text}</h2>
                            </div>

                            {/* Result Overlay */}
                            {localGameState === 'RESULT' && (
                                <div className={`mb-4 p-4  text-center font-black text-2xl uppercase animate-fade-in-up ${isCorrectLocal ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                    {isCorrectLocal ? 'Correct!' : 'Wrong!'}
                                </div>
                            )}

                            <div className="space-y-3">
                                {currentQ.options.map((opt, i) => {
                                    const colors = getAdaptiveColor(opt, i);
                                    const isSelected = selectedAnswer === i;
                                    const showResult = localGameState === 'RESULT';
                                    const isCorrect = i === currentQ.correctIndex;

                                    let colorStyle = `${colors.bg} ${colors.border} ${colors.text || 'text-white'}`;
                                    
                                    if (showResult) {
                                        if (isCorrect) colorStyle = "bg-green-600 border-green-800 text-white";
                                        else if (isSelected) colorStyle = "bg-red-600 border-red-800 text-white";
                                        else colorStyle = "bg-gray-800 border-gray-900 text-gray-500 opacity-50";
                                    }

                                    return (
                                        <button
                                            key={i}
                                            onClick={() => handleSelfPacedSubmit(i)}
                                            disabled={localGameState !== 'QUESTION'}
                                            className={`w-full p-4  border-b-[6px] text-left font-bold text-lg transition-all active:translate-y-1 active:translate-x-1 flex items-center justify-between min-h-[72px] shadow-lg relative overflow-hidden ${colorStyle}`}
                                        >
                                            <span className="leading-tight pr-2 relative z-10">{opt}</span>
                                            {showResult && isCorrect && <CheckCircle className="shrink-0 relative z-10" size={24} />}
                                            {showResult && isSelected && !isCorrect && <XCircle className="shrink-0 relative z-10" size={24} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </MotionDiv>
                    </AnimatePresence>
                </div>

                {/* Footer Next Button */}
                {localGameState === 'RESULT' && (
                    <div className="shrink-0 p-4 border-t border-gray-800 bg-gray-900 z-20">
                        <Button fullWidth onClick={nextSelfPacedQuestion} className="h-14 text-lg flex items-center gap-2">
                            Next Question <ArrowRight size={20}/>
                        </Button>
                    </div>
                )}
            </div>
        );
    }

    // --- LIVE GAME RENDERING ---
    // (Existing Live Logic Here)
    if (session.status === 'LOBBY') {
        const logo = session.ambassador?.groupLogo;
        const communityName = session.ambassador?.communityName;

        return (
            <div className="h-[100dvh] bg-gray-950 p-6 flex flex-col items-center justify-center text-white text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-gray-950 to-black pointer-events-none" />
                
                <MotionDiv initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-32 h-32 rounded-full border-4 border-gray-800 shadow-2xl mb-8 overflow-hidden bg-black shrink-0 relative flex items-center justify-center z-10">
                    {logo ? <img src={logo} alt="Community Logo" className="w-full h-full object-cover" /> : <Trophy size={48} className="text-blue-400" />}
                </MotionDiv>

                <h2 className="text-xl font-bold text-blue-400 mb-2 uppercase tracking-wide z-10">You're In!</h2>
                <div className="text-5xl font-black text-white mb-2 truncate max-w-full px-4 leading-tight z-10">{name}</div>
                {communityName && <div className="text-sm text-gray-500 font-bold uppercase tracking-widest mb-12 z-10">{communityName}</div>}
                
                <div className="flex items-center gap-3 bg-blue-900/20 px-6 py-4 rounded-full border border-blue-500/30 animate-pulse mt-auto mb-12 z-10">
                     <Loader2 className="animate-spin text-blue-400" size={20} />
                     <span className="text-blue-200 font-bold text-sm uppercase tracking-widest">Waiting for host...</span>
                </div>
            </div>
        );
    }

    if (session.status === 'QUESTION') {
        const q = session.questions[session.currentQuestionIndex];
        return (
            <div className="h-[100dvh] bg-gray-950 flex flex-col overflow-hidden relative">
                <div className="shrink-0 flex justify-between items-end mb-4 border-b border-gray-800 pb-4 p-6 bg-gray-900/80 backdrop-blur-md z-20">
                    <div>
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Question</span>
                        <div className="text-2xl font-black text-white leading-none">{session.currentQuestionIndex + 1}<span className="text-lg text-gray-600">/{session.questions.length}</span></div>
                    </div>
                    <div className="text-right">
                         <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">My Score</span>
                         <div className="text-xl font-bold text-blue-400 leading-none">{myPlayer?.score || 0}</div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col max-w-md mx-auto w-full relative z-10">
                    <MotionDiv key={q.id} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white text-gray-900 p-6 shadow-lg mb-6 min-h-[140px] flex items-center justify-center shrink-0 border-b-8 border-gray-200">
                         <h2 className="text-xl md:text-2xl font-black text-center leading-tight">{q.text}</h2>
                    </MotionDiv>
                    <div className="space-y-3">
                        {q.options.map((opt, i) => {
                            const isSelected = myPlayer?.lastAnswerIndex === i;
                            const colors = getAdaptiveColor(opt, i);
                            let baseStyle = `w-full p-4  border-b-[6px] text-left font-bold text-lg transition-all active:translate-y-1 active:translate-x-1 flex items-center justify-between min-h-[72px] shadow-lg relative overflow-hidden`;
                            let colorStyle = `${colors.bg} ${colors.border} ${colors.text || 'text-white'}`;
                            if (hasAnswered) {
                                if (isSelected) colorStyle = `${colors.bg} ${colors.border} ${colors.text || 'text-white'} ring-4 ring-white/50 scale-[1.02] z-20`;
                                else colorStyle = "bg-gray-800 border-gray-900 text-gray-500 opacity-50 grayscale";
                            }
                            return (
                                <button key={i} onClick={() => handleLiveAnswer(i)} disabled={hasAnswered} className={`${baseStyle} ${colorStyle}`}>
                                    <span className="leading-tight pr-2 relative z-10">{opt}</span>
                                    {isSelected && <CheckCircle className="shrink-0 relative z-10 animate-bounce" size={24} />}
                                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 pointer-events-none" />
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="shrink-0 py-4 text-center border-t border-gray-800 bg-gray-900 z-20">
                    {hasAnswered ? <div className="flex items-center gap-2 text-xs font-bold text-blue-400 animate-pulse uppercase tracking-widest bg-blue-900/20 px-4 py-2 rounded-full inline-flex border border-blue-500/20"><Clock size={14} /> Answer Submitted</div> : <div className="text-xs text-gray-500 font-bold uppercase tracking-widest animate-pulse">Make your choice!</div>}
                </div>
            </div>
        );
    }

    if (session.status === 'REVEAL' || session.status === 'LEADERBOARD') {
        const isCorrect = myPlayer?.isCorrect;
        
        if (isCorrect === null || isCorrect === undefined) {
            return (
                <div className="h-[100dvh] flex flex-col items-center justify-center p-6 text-white text-center bg-gray-950">
                    <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
                    <h2 className="text-xl font-bold text-gray-400 animate-pulse">Evaluating Answer...</h2>
                </div>
            );
        }

        return (
            <div className={`h-[100dvh] flex flex-col items-center justify-center p-6 text-white text-center transition-colors duration-500 relative overflow-hidden ${isCorrect ? 'bg-green-600' : 'bg-red-600'}`}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/10 via-transparent to-black/40 pointer-events-none" />
                <MotionDiv initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-6 relative z-10">
                    {isCorrect ? <CheckCircle size={100} className="text-white drop-shadow-2xl" /> : <XCircle size={100} className="text-white drop-shadow-2xl" />}
                </MotionDiv>
                <h1 className="text-5xl font-black uppercase mb-4 drop-shadow-lg tracking-tighter relative z-10">{isCorrect ? 'CORRECT!' : 'WRONG!'}</h1>
                {isCorrect && <MotionDiv initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-black/20 px-8 py-3 rounded-full text-xl font-bold mb-10 shadow-inner border border-white/20 relative z-10 backdrop-blur-sm">+1000 Pts</MotionDiv>}
                <div className="bg-black/30 p-6 w-full max-w-xs backdrop-blur-md shadow-2xl border border-white/10 relative z-10">
                    <div className="text-xs text-white/70 uppercase font-bold mb-1 tracking-wider">Total Score</div>
                    <div className="text-6xl font-black mb-6 tracking-tight">{myPlayer?.score || 0}</div>
                    <div className="flex justify-between items-center border-t border-white/10 pt-4">
                        <span className="text-sm font-bold text-white/80 uppercase tracking-wide">Streak</span>
                        <div className="flex items-center gap-2 text-white font-bold text-2xl">{(myPlayer?.streak || 0) > 1 && <Flame className="text-orange-400 fill-orange-400 animate-pulse" />} {myPlayer?.streak || 0}</div>
                    </div>
                </div>
                <div className="mt-auto mb-8 flex items-center gap-3 text-white/70 text-sm font-bold bg-black/20 px-6 py-3 rounded-full border border-white/10 z-10"><Loader2 className="animate-spin" size={18} /> Waiting for next round...</div>
            </div>
        );
    }

    if (session.status === 'FINISHED') {
        const isMeWinner = myPlayer && myPlayer.score === session.winnerScore && myPlayer.name === session.winnerName;
        return (
            <div className="h-[100dvh] bg-gray-950 p-6 flex flex-col items-center justify-center text-white text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-gray-950 to-black pointer-events-none" />
                <div className="w-24 h-24 bg-gray-900 rounded-full flex items-center justify-center mb-6 border-4 border-gray-800 shadow-xl relative animate-pulse z-10">
                    {isMeWinner ? <Trophy size={48} className="text-yellow-400"/> : <Lock size={40} className="text-gray-600"/>}
                </div>
                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-2 uppercase italic z-10 relative">{isMeWinner ? "CHAMPION!" : "GAME OVER"}</h1>
                {session.winnerName && (
                    <div className="bg-gray-900/80 p-6 border border-yellow-500/30 w-full max-w-xs mb-8 shadow-lg z-10 relative">
                        <div className="text-[10px] text-yellow-500 uppercase font-bold tracking-widest mb-2">Winner</div>
                        <div className="text-3xl font-black text-white mb-1 truncate">{session.winnerName}</div>
                        <div className="text-sm text-gray-400 font-mono">{session.winnerScore} Pts</div>
                    </div>
                )}
                <Button variant="secondary" onClick={handleLeave} className="mt-4 text-sm px-8 z-10 relative flex items-center gap-2"><Home size={16}/> Return to Community</Button>
            </div>
        )
    }

    return null;
};