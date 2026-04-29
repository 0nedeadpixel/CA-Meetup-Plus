import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, BrainCircuit, Play, Users, StopCircle, RefreshCw, QrCode, X, Copy, Check, ChevronRight, Trophy, Link as LinkIcon, AlertCircle, Maximize2, Upload, FileJson, Download, CheckCircle2, ChevronDown, ChevronUp, Instagram, MapPin, Star, Zap, Clock, Calendar, ArrowRight, Activity, Eye, Loader2, Archive, Crown, Medal, Trash2, CheckSquare, Square, Cloud, Lock, Image as ImageIcon, Share2 } from 'lucide-react';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import { Button } from './Button';
import { QRCodeSVG } from 'qrcode.react';
import { v4 as uuidv4 } from 'uuid';
// @ts-ignore
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp, collection, deleteDoc, query, where, writeBatch, getDocs, getDoc, arrayUnion, increment } from 'firebase/firestore';
// @ts-ignore
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';
import { TriviaSession, TriviaQuestion, TriviaPlayer, AppSettings, UserRole } from '../types';
import { ConfirmationModal } from './ConfirmationModal';
import { useToast } from './ToastContext';

// Fix for framer-motion type mismatch
const MotionDiv = motion.div as any;

// --- DATA PRESETS ---

const PRESET_PACKS = {
    GEN1: {
        name: "Gen 1 Classics",
        description: "Red, Blue & Yellow nostalgia. Easy.",
        icon: <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png" alt="Pikachu" className="w-14 h-14 object-contain" style={{ imageRendering: 'pixelated' }} />,
        questions: [
            { text: "Which Pokémon is #001 in the Pokédex?", options: ["Bulbasaur", "Charmander", "Squirtle", "Pikachu"], correctIndex: 0, timeLimit: 10 },
            { text: "What type is the Pokémon 'Sudowoodo'?", options: ["Grass", "Rock", "Ground", "Wood"], correctIndex: 1, timeLimit: 10 },
            { text: "Who evolves into Gengar?", options: ["Gastly", "Haunter", "Graveler", "Koffing"], correctIndex: 1, timeLimit: 10 },
            { text: "Which Eeveelution was introduced in Gen 1?", options: ["Espeon", "Umbreon", "Vaporeon", "Sylveon"], correctIndex: 2, timeLimit: 10 },
            { text: "What is the name of Ash's first Butterfree?", options: ["Happy", "Dusty", "It had no name", "Mothra"], correctIndex: 2, timeLimit: 10 },
            { text: "Which Pokémon can learn Transform?", options: ["Mew", "Ditto", "Both", "Neither"], correctIndex: 2, timeLimit: 10 },
            { text: "What holds the item 'Leek' naturally?", options: ["Farfetch'd", "Snorlax", "Meowth", "Chansey"], correctIndex: 0, timeLimit: 10 },
            { text: "How many Gym Badges do you need to face the Elite Four?", options: ["4", "6", "8", "10"], correctIndex: 2, timeLimit: 10 },
            { text: "Which city is home to the Department Store?", options: ["Celadon City", "Saffron City", "Cerulean City", "Pewter City"], correctIndex: 0, timeLimit: 10 },
            { text: "Magikarp evolves into which Pokémon?", options: ["Lapras", "Dragonite", "Gyarados", "Seadra"], correctIndex: 2, timeLimit: 10 },
        ]
    },
    GEN2: {
        name: "Johto Journeys",
        description: "Gold, Silver & Crystal. Medium.",
        icon: <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/155.png" alt="Cyndaquil" className="w-14 h-14 object-contain" style={{ imageRendering: 'pixelated' }} />,
        questions: [
            { text: "Which is a Gen 2 Starter?", options: ["Treecko", "Cyndaquil", "Torchic", "Mudkip"], correctIndex: 1, timeLimit: 10 },
            { text: "Who is the evolved form of Scyther introduced in Gen 2?", options: ["Scizor", "Kleavor", "Scyther Two", "Kabutops"], correctIndex: 0, timeLimit: 10 },
            { text: "Which Baby Pokémon is the pre-evolution of Pikachu?", options: ["Plusle", "Minun", "Pichu", "Mimikyu"], correctIndex: 2, timeLimit: 10 },
            { text: "What type is Umbreon?", options: ["Psychic", "Ghost", "Dark", "Poison"], correctIndex: 2, timeLimit: 10 },
            { text: "Who is the Champion of the Johto League?", options: ["Red", "Blue", "Lance", "Cynthia"], correctIndex: 2, timeLimit: 10 },
            { text: "Who is the Gym Leader of Goldenrod City (Normal Type)?", options: ["Whitney", "Jasmine", "Clair", "Bugsy"], correctIndex: 0, timeLimit: 10 },
            { text: "Which Legendary Beast is Electric-type?", options: ["Entei", "Suicune", "Raikou", "Ho-Oh"], correctIndex: 2, timeLimit: 10 },
            { text: "What item evolves Slowpoke into Slowking?", options: ["King's Rock", "Sun Stone", "Water Stone", "Metal Coat"], correctIndex: 0, timeLimit: 10 },
            { text: "Which Pokémon is known as the Time Travel Pokémon?", options: ["Dialga", "Celebi", "Mew", "Jirachi"], correctIndex: 1, timeLimit: 10 },
            { text: "How many new types were introduced in Gen 2?", options: ["1 (Fairy)", "2 (Dark/Steel)", "3 (Dark/Steel/Fairy)", "0"], correctIndex: 1, timeLimit: 10 },
        ]
    },
};

// Returns an object with bg class, text class, and border class
const getAdaptiveColor = (text: string, index: number) => {
    const t = text.toLowerCase();
    
    // Explicit Colors
    if (t.includes('red')) return { bg: 'bg-red-600', text: 'text-white', border: 'border-red-800' };
    if (t.includes('blue')) return { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-800' };
    if (t.includes('green')) return { bg: 'bg-green-600', text: 'text-white', border: 'border-green-800' };
    if (t.includes('yellow')) return { bg: 'bg-yellow-400', text: 'text-black', border: 'border-yellow-600' }; 
    
    // Fallback based on index (Classic Game Show Colors)
    const defaults = [
        { bg: 'bg-red-500', text: 'text-white', border: 'border-red-700' },
        { bg: 'bg-blue-500', text: 'text-white', border: 'border-blue-700' },
        { bg: 'bg-yellow-500', text: 'text-black', border: 'border-yellow-700' },
        { bg: 'bg-green-500', text: 'text-white', border: 'border-green-700' }
    ];
    return defaults[index % 4];
}

interface TriviaViewProps {
    settings?: AppSettings;
}

export const TriviaView: React.FC<TriviaViewProps> = ({ settings }) => {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [userRole, setUserRole] = useState<UserRole>('user');

    // Identity State
    const [myDeviceId, setMyDeviceId] = useState<string>('');

    // Host Logic State
    const [mySessions, setMySessions] = useState<TriviaSession[]>([]);
    
    // Current "Focused" Session (Being controlled or viewed)
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [session, setSession] = useState<TriviaSession | null>(null);
    const [players, setPlayers] = useState<TriviaPlayer[]>([]);
    
    // VIEW STATE
    const [viewMode, setViewMode] = useState<'DASHBOARD' | 'SETUP' | 'LOBBY' | 'GAME' | 'MONITOR'>('DASHBOARD');
    
    // SETUP STATE
    const [selectedPack, setSelectedPack] = useState<keyof typeof PRESET_PACKS | 'CUSTOM'>('GEN1');
    const [customQuestions, setCustomQuestions] = useState<any[]>([]);
    const [setupMode, setSetupMode] = useState<'LIVE' | 'SELF_PACED'>('LIVE');
    const [setupTitle, setSetupTitle] = useState('');
    const [setupDuration, setSetupDuration] = useState('24'); // Hours
    
    // SHARE / IMPORT STATE
    const [importCode, setImportCode] = useState('');
    const [shareConfigEnabled, setShareConfigEnabled] = useState(false);
    const [shareConfigBg, setShareConfigBg] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    // GAME RUNTIME STATE
    const [timer, setTimer] = useState(0);
    const [linkCopied, setLinkCopied] = useState(false);
    const [showQrModal, setShowQrModal] = useState(false);
    const [showEndGameModal, setShowEndGameModal] = useState(false);

    // HISTORY SELECTION
    const [historySelection, setHistorySelection] = useState<Set<string>>(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // PLAYER DETAIL MODAL
    const [selectedPlayer, setSelectedPlayer] = useState<TriviaPlayer | null>(null);

    // 0. AUTH LISTENER & ROLE FETCH
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user: any) => {
            setCurrentUser(user);
            if (user) {
                try {
                    const snap = await getDoc(doc(db, 'users', user.uid));
                    if (snap.exists()) {
                        let r = (snap.data().role || 'user').toLowerCase();
                        if (user.email === 'elmersdesign@gmail.com') r = 'super_admin';
                        setUserRole(r as UserRole);
                    }
                } catch(e) { console.error("Error fetching role", e); }
            } else {
                setUserRole('user');
            }
        });
        return () => unsub();
    }, []);

    // 0.1 INITIALIZE DEVICE ID (STRICT PRIVACY FIX)
    useEffect(() => {
        let id = localStorage.getItem('pogo_device_id');
        // Critical: If ID is 'host' or missing, generate a new unique one to prevent shared data
        if (!id || id === 'host' || id === 'unknown') {
            id = uuidv4();
            localStorage.setItem('pogo_device_id', id);
        }
        setMyDeviceId(id);
    }, []);

    // 0.5 ADOPTION LOGIC (Safety Net + Active Session Protection)
    useEffect(() => {
        // Only run when we have a valid unique ID and/or user
        if (!myDeviceId && !currentUser) return;

        const adoptSessions = async () => {
            const batch = writeBatch(db);
            let count = 0;

            // 1. ACTIVE SESSION RESCUE: If we are currently hosting a session, explicitly claim it
            // This prevents losing access to a live game when the device ID rotates
            if (sessionId) {
                const sessionRef = doc(db, 'trivia_sessions', sessionId);
                const sessionSnap = await getDoc(sessionRef);
                if (sessionSnap.exists()) {
                    const data = sessionSnap.data();
                    // If session has no hostUid, OR if it belonged to 'host' (the shared ID)
                    if (!data.hostUid || data.hostDevice === 'host') {
                        const updates: any = { hostDevice: myDeviceId }; // Always update to strict ID
                        if (currentUser) updates.hostUid = currentUser.uid; // Add cloud owner if logged in
                        batch.update(sessionRef, updates);
                        count++;
                    }
                }
            }

            // 2. ORPHAN ADOPTION (Logged In Only)
            // Find past sessions created by this specific device that haven't been synced to cloud
            if (currentUser) {
                const q = query(
                    collection(db, 'trivia_sessions'), 
                    where('hostDevice', '==', myDeviceId),
                    where('hostUid', '==', null) // Only un-owned ones
                );
                
                // Note: We can't query for 'hostUid == null' easily in Firestore without composite index sometimes,
                // so we query by device and filter in code if needed, but 'hostDevice' matches are safe to adopt.
                const snap = await getDocs(q);
                snap.forEach(docSnap => {
                    const data = docSnap.data();
                    if (!data.hostUid) {
                        batch.update(docSnap.ref, { hostUid: currentUser.uid });
                        count++;
                    }
                });
            }
            
            if (count > 0) {
                console.log(`Adopting ${count} sessions for ${currentUser ? 'User ' + currentUser.uid : 'Device ' + myDeviceId}`);
                await batch.commit();
            }
        };
        
        adoptSessions();
    }, [currentUser, myDeviceId, sessionId]);

    // 1. FETCH MY SESSIONS (DASHBOARD)
    useEffect(() => {
        if (!myDeviceId && !currentUser) return; // Wait for init

        let q;
        if (currentUser) {
            // Cloud Mode: Show everything owned by this account
            q = query(collection(db, 'trivia_sessions'), where('hostUid', '==', currentUser.uid));
        } else {
            // Local Mode: STRICT filter by unique device ID
            q = query(collection(db, 'trivia_sessions'), where('hostDevice', '==', myDeviceId));
        }
        
        const unsub = onSnapshot(q, (snap: any) => {
            const list = snap.docs.map((d: any) => ({ ...d.data() } as TriviaSession));
            // Show ALL sessions, sorted new to old
            setMySessions(list.sort((a: any, b: any) => b.createdAt - a.createdAt));
        });
        return () => unsub();
    }, [currentUser, myDeviceId]);

    // 2. SYNC ACTIVE SESSION
    useEffect(() => {
        if (!sessionId) return;

        const unsubSession = onSnapshot(doc(db, 'trivia_sessions', sessionId), (snap: any) => {
            const data = snap.data() as TriviaSession;
            if (!snap.exists()) {
                setSessionId(null);
                setSession(null);
                if (viewMode !== 'DASHBOARD') setViewMode('DASHBOARD');
            } else {
                // STRICT PADLOCK: You can ONLY access a live trivia game if you created it.
                const isOwner = data.hostUid 
                    ? currentUser && data.hostUid === currentUser.uid
                    : data.hostDevice === myDeviceId;

                if (!isOwner) {
                    addToast("Unauthorized: You cannot access another Host's active Trivia session.", 'error');
                    setSessionId(null);
                    setSession(null);
                    setViewMode('DASHBOARD');
                    return;
                }

                setSession(data);
                
                // Route based on mode and status
                if (data.mode === 'SELF_PACED' || !data.active) {
                    setViewMode('MONITOR');
                } else {
                    if (data.status === 'LOBBY') setViewMode('LOBBY');
                    else setViewMode('GAME');
                }
            }
        });

        const unsubPlayers = onSnapshot(collection(db, `trivia_sessions/${sessionId}/players`), (snap: any) => {
            const list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as TriviaPlayer));
            // Sort by score
            list.sort((a: any, b: any) => b.score - a.score);
            setPlayers(list);
        });

        return () => { unsubSession(); unsubPlayers(); };
    }, [sessionId]);

    // 3. TIMER LOGIC (LIVE ONLY)
    useEffect(() => {
        let interval: any;
        if (session && session.active && session.mode !== 'SELF_PACED' && session.status === 'QUESTION' && timer > 0) {
            interval = setInterval(() => {
                setTimer(prev => prev - 1);
            }, 1000);
        } else if (timer === 0 && session?.active && session?.status === 'QUESTION' && session?.mode !== 'SELF_PACED') {
            handleReveal();
        }
        return () => clearInterval(interval);
    }, [session?.status, timer, session?.mode, session?.active]);


    // --- ACTIONS ---

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const json = JSON.parse(ev.target?.result as string);
                if (Array.isArray(json) && json.length > 0 && json[0].text && json[0].options) {
                    setCustomQuestions(json);
                    setSelectedPack('CUSTOM');
                } else { addToast("Invalid JSON format.", 'error'); }
            } catch (err) { addToast("Error parsing JSON file.", 'error'); }
        };
        reader.readAsText(file);
    };

    const downloadTemplate = () => {
        const template = [
            { text: "Example: What color is Pikachu?", options: ["Red", "Blue", "Yellow", "Green"], correctIndex: 2, timeLimit: 10 }
        ];
        const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = "trivia_template.json"; a.click();
    };

    // --- PACK SHARING LOGIC ---
    const handleSharePack = async () => {
        if (!customQuestions || customQuestions.length === 0) {
            addToast("No custom questions to share! Upload a file or define some first.", 'warning');
            return;
        }
        // Generate short code
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        try {
            await setDoc(doc(db, 'trivia_packs', code), {
                id: code,
                questions: customQuestions,
                createdAt: serverTimestamp(),
                authorUid: currentUser ? currentUser.uid : 'anon',
                name: setupTitle || 'Shared Pack'
            });
            await navigator.clipboard.writeText(code);
            addToast(`Pack Shared & Code Copied: ${code}`, 'success');
        } catch (e) {
            addToast("Failed to share pack.", 'error');
        }
    };

    const handleImportPack = async () => {
        if (!importCode || importCode.length < 4) return;
        try {
            const snap = await getDoc(doc(db, 'trivia_packs', importCode.trim().toUpperCase()));
            if (snap.exists()) {
                const data = snap.data();
                if (data.questions && Array.isArray(data.questions)) {
                    setCustomQuestions(data.questions);
                    setSelectedPack('CUSTOM');
                    addToast(`Loaded pack: ${data.name || 'Untitled'}`, 'success');
                    setImportCode('');
                } else {
                    addToast("Invalid pack data.", 'error');
                }
            } else {
                addToast("Pack code not found.", 'error');
            }
        } catch (e) {
            addToast("Error importing pack.", 'error');
        }
    };

    const createSession = async () => {
        try {
            // Validate Inputs
            if (setupMode === 'SELF_PACED' && !setupTitle.trim()) { addToast("Please name your session.", 'warning'); return; }

            // Determine Question Set
            let finalQuestions: any[] = [];
            if (selectedPack === 'CUSTOM') { finalQuestions = customQuestions; } 
            else { 
                // @ts-ignore
                finalQuestions = PRESET_PACKS[selectedPack].questions; 
            }

            if (!finalQuestions || finalQuestions.length === 0) { addToast("No questions selected!", 'warning'); return; }

            // Add IDs to questions
            const questionsWithIds = finalQuestions.map((q: any) => ({
                id: uuidv4(),
                text: q.text,
                options: q.options,
                correctIndex: q.correctIndex,
                timeLimit: q.timeLimit || 15
            }));

            const id = uuidv4();
            const now = Date.now();
            
            // Calculate Expiry for Self-Paced
            let expiresAt = 0;
            if (setupMode === 'SELF_PACED') {
                expiresAt = now + (parseInt(setupDuration) * 60 * 60 * 1000);
            }

            // Create object with 'any' type to construct it safely without undefined fields
            const newSession: any = {
                id,
                hostDevice: myDeviceId, // STRICT ID
                // ADDED: Cloud Owner
                hostUid: currentUser ? currentUser.uid : null,
                active: true,
                createdAt: now,
                mode: setupMode,
                title: setupMode === 'SELF_PACED' ? setupTitle : `Live Trivia ${new Date().toLocaleTimeString()}`,
                status: 'LOBBY',
                currentQuestionIndex: 0,
                questions: questionsWithIds,
            };

            // Conditionally add fields to avoid passing 'undefined' to Firestore (which crashes setDoc)
            if (setupMode === 'SELF_PACED') {
                newSession.expiresAt = expiresAt;
            }

            if (settings?.ambassador) {
                newSession.ambassador = settings.ambassador;
            }

            // SUPER ADMIN SHARE CONFIG
            if (userRole === 'super_admin') {
                newSession.shareConfig = {
                    enabled: shareConfigEnabled,
                    backgroundImage: shareConfigBg || null
                };
            }
            
            await setDoc(doc(db, 'trivia_sessions', id), newSession);
            setSessionId(id); // This triggers the useEffect to change view
        } catch (e: any) {
            console.error("Error creating session:", e);
            addToast("Failed to start session: " + e.message, 'error');
        }
    };

    const resumeSession = (sid: string) => {
        setSessionId(sid);
    };

    // --- LIVE GAME LOGIC ---

    const startGame = async () => {
        if (!sessionId) return;
        const q = session?.questions[0];
        setTimer(q ? q.timeLimit : 15);
        await updateDoc(doc(db, 'trivia_sessions', sessionId), {
            status: 'QUESTION',
            currentQuestionIndex: 0,
            startTime: Date.now()
        });
    };

    const handleReveal = async () => {
        if (!sessionId || !session) return;
        const currentQ = session.questions[session.currentQuestionIndex];
        const batchUpdates: Promise<void>[] = [];
        const sessionStartTime = session.startTime || (Date.now() - (currentQ.timeLimit * 1000));
        
        players.forEach(p => {
            let points = 0;
            let isCorrect = false;
            let newStreak = p.streak || 0;

            if (p.lastAnswerIndex === currentQ.correctIndex) {
                isCorrect = true;
                points = 1000;
                newStreak += 1;

                // Time Bonus (Up to 1000 now)
                if (p.lastAnswerTime) {
                    const timeTakenMs = p.lastAnswerTime - sessionStartTime;
                    const timeTakenMsNum = p.lastAnswerTime - sessionStartTime;
                    const timeTakenSec = Math.max(0, timeTakenMsNum / 1000);
                    const timeRatio = Math.min(1, timeTakenSec / currentQ.timeLimit);
                    // NEW: Time bonus max is now 1000
                    const timeBonus = Math.floor(1000 * (1 - timeRatio));
                    points += Math.max(0, timeBonus);
                }
                
                // Streak Bonus (Scaling)
                // NEW: 100 per streak, max 500
                if (newStreak >= 2) {
                    points += Math.min(newStreak * 100, 500);
                }
            } else {
                newStreak = 0;
            }

            const answerRecord = {
                questionIndex: session.currentQuestionIndex,
                selectedOption: p.lastAnswerIndex !== null ? p.lastAnswerIndex : -1,
                isCorrect: isCorrect,
                timeTaken: p.lastAnswerTime ? Math.max(0, (p.lastAnswerTime - sessionStartTime) / 1000) : 0
            };

            const ref = doc(db, `trivia_sessions/${sessionId}/players/${p.id}`);
            batchUpdates.push(updateDoc(ref, {
                score: (p.score || 0) + points,
                streak: newStreak,
                isCorrect: isCorrect,
                lastAnswerIndex: null,
                answerHistory: arrayUnion(answerRecord)
            }));
        });
        await Promise.all(batchUpdates);
        await updateDoc(doc(db, 'trivia_sessions', sessionId), { status: 'REVEAL' });
    };

    const nextQuestion = async () => {
        if (!sessionId || !session) return;
        const nextIdx = session.currentQuestionIndex + 1;
        const batchUpdates = players.map(p => 
            updateDoc(doc(db, `trivia_sessions/${sessionId}/players/${p.id}`), {
                lastAnswerIndex: null, isCorrect: null, lastAnswerTime: null
            })
        );
        await Promise.all(batchUpdates);

        if (nextIdx >= session.questions.length) {
            const winner = players.length > 0 ? players[0] : null;
            await updateDoc(doc(db, 'trivia_sessions', sessionId), { 
                status: 'FINISHED', winnerName: winner ? winner.name : 'No One', winnerScore: winner ? winner.score : 0
            });
        } else {
            const nextQ = session.questions[nextIdx];
            setTimer(nextQ.timeLimit);
            await updateDoc(doc(db, 'trivia_sessions', sessionId), { 
                status: 'QUESTION', currentQuestionIndex: nextIdx, startTime: Date.now()
            });
        }
    };

    const showLeaderboard = async () => {
        if (!sessionId) return;
        await updateDoc(doc(db, 'trivia_sessions', sessionId), { status: 'LEADERBOARD' });
    };

    const confirmEndGame = async () => {
        if (!sessionId) return;
        // Mark inactive, don't delete
        await updateDoc(doc(db, 'trivia_sessions', sessionId), { active: false });
        // Don't force dashboard, just refresh view to show Monitor
        // setSessionId(null);
        // setViewMode('DASHBOARD');
        // Let the useEffect handle the viewMode switch to MONITOR if active goes false
    };
    
    const handleEndGameClick = () => {
        setShowEndGameModal(true);
    };

    // --- BULK DELETE LOGIC ---
    const toggleSelection = (id: string) => {
        const next = new Set(historySelection);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setHistorySelection(next);
    };

    const handleBulkDelete = async () => {
        const batch = writeBatch(db);
        historySelection.forEach(id => {
            const ref = doc(db, 'trivia_sessions', id);
            batch.delete(ref);
        });
        await batch.commit();
        setHistorySelection(new Set());
        setIsSelectionMode(false);
        setShowDeleteConfirm(false);
    };

    const constructJoinUrl = () => {
        let baseUrl = window.location.origin + window.location.pathname;
        if (baseUrl.endsWith('/')) { baseUrl = baseUrl.slice(0, -1); }
        return `${baseUrl}/#/trivia/play/${sessionId}`;
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(constructJoinUrl());
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
    };
    
    const renderLobby = () => (
        <div className="flex flex-col h-full bg-gray-950">
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-4xl mx-auto w-full space-y-6">
                    {/* 1. Share Card (White Theme like Self-Paced) */}
                    <div className="bg-white p-4 flex flex-col items-center justify-center shadow-2xl relative">
                        <QRCodeSVG value={constructJoinUrl()} size={250} includeMargin={true} />
                        <h3 className="text-black font-bold text-2xl mt-4">Scan to Join</h3>
                        <div className="flex gap-2 mt-4 mb-2">
                            <button 
                                onClick={() => setShowQrModal(true)} 
                                className="px-4 py-2 bg-gray-100 rounded-full text-xs font-bold text-gray-700 flex items-center gap-2 hover:bg-gray-200 transition-colors"
                            >
                                <Maximize2 size={14}/> Fullscreen
                            </button>
                            <button 
                                onClick={handleCopyLink} 
                                className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-colors ${linkCopied ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'}`}
                            >
                                {linkCopied ? <Check size={14}/> : <LinkIcon size={14}/>}
                                {linkCopied ? 'Link Copied!' : 'Copy Link'}
                            </button>
                        </div>
                    </div>

                    {/* 2. Player Grid */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Users className="text-blue-400" /> 
                                Players Ready <span className="bg-blue-900/30 text-blue-400 px-2 py-0.5 text-sm">{players.length}</span>
                            </h3>
                        </div>
                        
                        {players.length === 0 ? (
                            <div className="bg-gray-900 border-2 border-dashed border-gray-800 p-8 text-center text-gray-500">
                                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Loader2 className="animate-spin text-gray-600" size={24}/>
                                </div>
                                <p>Waiting for players to join...</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                {players.map(p => (
                                    /* Fixed: Replace motion.div with typed MotionDiv to fix property type errors */
                                    <MotionDiv 
                                        initial={{scale: 0.8, opacity: 0}} 
                                        animate={{scale: 1, opacity: 1}} 
                                        key={p.id} 
                                        className="bg-gray-800 p-3 border border-gray-700 flex items-center gap-3 shadow-sm"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                                            {p.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="font-bold text-sm truncate text-gray-200">{p.name}</span>
                                    </MotionDiv>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 3. Sticky Footer Action */}
            <div className="p-4 border-t border-gray-800 bg-gray-900 sticky bottom-0 z-30">
                <div className="max-w-4xl mx-auto">
                    <Button 
                        onClick={startGame} 
                        disabled={players.length === 0}
                        fullWidth 
                        className="h-16 text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg shadow-blue-900/20" 
                        icon={<Play size={24} fill="currentColor"/>}
                    >
                        Start Game
                    </Button>
                </div>
            </div>
        </div>
    );

    const renderGameScreen = () => {
        if (!session) return null;
        
        if (session.status === 'FINISHED') {
             return (
                 <div className="flex flex-col items-center justify-center min-h-full p-6 text-center">
                     <Trophy size={80} className="text-yellow-400 mb-4 animate-bounce"/>
                     <h2 className="text-4xl font-black text-white mb-2">GAME OVER</h2>
                     <div className="text-2xl text-gray-400 mb-8">Winner: <span className="text-yellow-400">{session.winnerName}</span></div>
                     <Button onClick={handleEndGameClick} variant="secondary">Close Session</Button>
                 </div>
             )
        }

        const currentQ = session.questions[session.currentQuestionIndex];
        
        return (
            <div className="flex flex-col h-full">
                {/* Question Display */}
                <div className="flex-1 flex flex-col items-center justify-center p-6">
                    <div className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">
                        Question {session.currentQuestionIndex + 1} of {session.questions.length}
                    </div>
                    <h2 className="text-3xl md:text-5xl font-black text-center text-white mb-12 max-w-4xl leading-tight">
                        {currentQ.text}
                    </h2>
                    
                    {session.status === 'QUESTION' && (
                        <div className="flex items-center gap-4 mb-8">
                            <div className="text-6xl font-black font-mono text-white tabular-nums">
                                {timer}
                            </div>
                        </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl">
                        {currentQ.options.map((opt, i) => {
                            const colors = getAdaptiveColor(opt, i);
                            const isCorrect = i === currentQ.correctIndex;
                            const showAnswer = session.status === 'REVEAL' || session.status === 'LEADERBOARD';
                            
                            let style = `p-6  border-b-8 text-xl font-bold text-left transition-all ${colors.bg} ${colors.border} ${colors.text || 'text-white'}`;
                            
                            if (showAnswer) {
                                if (isCorrect) style += " ring-4 ring-white scale-105 z-10 opacity-100";
                                else style += " opacity-30 grayscale";
                            }
                            
                            return (
                                <div key={i} className={style}>
                                    {opt}
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Controls Footer */}
                <div className="bg-gray-800 p-4 border-t border-gray-700 flex justify-between items-center z-50">
                     <div className="text-white font-bold flex items-center gap-2">
                        <Users size={20} className="text-gray-500"/> {players.length} Players
                     </div>
                     <div className="flex gap-4">
                         {session.status === 'QUESTION' && (
                             <Button onClick={handleReveal} className="bg-orange-500 hover:bg-orange-400">Reveal Answer</Button>
                         )}
                         {session.status === 'REVEAL' && (
                             <Button onClick={nextQuestion} className="bg-blue-600 hover:bg-blue-500">Next Question <ArrowRight/></Button>
                         )}
                         {session.status === 'LEADERBOARD' && (
                             <Button onClick={nextQuestion} className="bg-blue-600 hover:bg-blue-500">Next Question <ArrowRight/></Button>
                         )}
                     </div>
                </div>
            </div>
        );
    };

    // --- RENDER DASHBOARD ---
    if (viewMode === 'DASHBOARD') {
        const liveSessions = mySessions.filter(s => s.mode !== 'SELF_PACED' && s.active);
        const selfPacedSessions = mySessions.filter(s => s.mode === 'SELF_PACED' && s.active);
        const historySessions = mySessions.filter(s => !s.active);

        return (
            <div className="h-full w-full bg-gray-950 flex flex-col text-white">
                <ConfirmationModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} onConfirm={handleBulkDelete} title={`Delete ${historySelection.size} Sessions?`} message="This action cannot be undone." confirmText="Delete" isDanger={true} />

                <div className="p-4 border-b border-gray-800 flex items-center gap-4 bg-gray-900 sticky top-0 z-30">
                    <button onClick={() => navigate('/')} className="p-2 bg-gray-800 rounded-full border border-gray-700 text-gray-400 hover:text-white"><ArrowLeft size={20}/></button>
                    <div className="flex-1">
                        <h2 className="text-xl font-bold flex items-center gap-2 text-blue-400"><BrainCircuit size={20}/> Trivia Master</h2>
                        <div className="flex items-center gap-2">
                            <p className="text-xs text-gray-500">Manage your games</p>
                            {currentUser && (
                                <span className="flex items-center gap-1 text-[10px] bg-green-900/30 text-green-400 px-2 py-0.5 border border-green-900/50 font-bold">
                                    <Cloud size={10} /> Cloud Active
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Create New Button */}
                    <button onClick={() => setViewMode('SETUP')} className="w-full p-6 border-2 border-dashed border-gray-800 flex flex-col items-center justify-center text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors group">
                        <BrainCircuit size={32} className="mb-2 group-hover:scale-110 transition-transform"/>
                        <span className="font-bold">Create New Session</span>
                    </button>

                    {/* Active Live Games */}
                    {liveSessions.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2"><Zap size={14} className="text-yellow-400"/> Active Live Games</h3>
                            <div className="space-y-3">
                                {liveSessions.map(s => (
                                    <div key={s.id} className="bg-gray-900 border border-gray-800 p-4 flex justify-between items-center">
                                        <div>
                                            <div className="font-bold text-white text-lg">{s.title || 'Live Trivia'}</div>
                                            <div className="text-xs text-gray-500">{new Date(s.createdAt).toLocaleString()}</div>
                                        </div>
                                        <Button onClick={() => resumeSession(s.id)} className="h-10 text-sm px-4">Resume</Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Active Self-Paced */}
                    {selfPacedSessions.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2"><Clock size={14} className="text-blue-400"/> Self-Paced Challenges</h3>
                            <div className="space-y-3">
                                {selfPacedSessions.map(s => {
                                    const isExpired = s.expiresAt && Date.now() > s.expiresAt;
                                    return (
                                        <div key={s.id} className={`bg-gray-900 border border-gray-800  p-4 flex justify-between items-center ${isExpired ? 'opacity-60' : ''}`}>
                                            <div>
                                                <div className="font-bold text-white text-lg flex items-center gap-2">
                                                    {s.title}
                                                    {isExpired && <span className="text-[10px] bg-red-900 text-red-300 px-1.5">EXPIRED</span>}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    Expires: {s.expiresAt ? new Date(s.expiresAt).toLocaleString() : 'Never'}
                                                </div>
                                            </div>
                                            <Button variant="secondary" onClick={() => resumeSession(s.id)} className="h-10 text-sm px-4">Monitor</Button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* HISTORY */}
                    {historySessions.length > 0 && (
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2"><Archive size={14}/> Past Sessions</h3>
                                <button 
                                    onClick={() => { setIsSelectionMode(!isSelectionMode); setHistorySelection(new Set()); }}
                                    className={`text-xs font-bold px-2 py-1  ${isSelectionMode ? 'bg-blue-600 text-white' : 'text-blue-400'}`}
                                >
                                    {isSelectionMode ? 'Done' : 'Manage'}
                                </button>
                            </div>
                            
                            {isSelectionMode && historySelection.size > 0 && (
                                <div className="mb-4">
                                    <Button variant="danger" fullWidth onClick={() => setShowDeleteConfirm(true)} icon={<Trash2 size={16}/>}>
                                        Delete {historySelection.size} Selected
                                    </Button>
                                </div>
                            )}

                            <div className="space-y-2 opacity-100 transition-opacity">
                                {historySessions.map(s => (
                                    <div 
                                        key={s.id} 
                                        className={`bg-gray-900 border  p-4 flex items-center gap-3 group transition-colors cursor-pointer ${historySelection.has(s.id) ? 'border-blue-500 bg-blue-900/10' : 'border-gray-800 hover:border-gray-700'}`}
                                        onClick={() => {
                                            if (isSelectionMode) toggleSelection(s.id);
                                            // Optional: else resumeSession(s.id) if we want clickable history
                                        }}
                                    >
                                        {isSelectionMode && (
                                            <div className={`w-5 h-5  border flex items-center justify-center ${historySelection.has(s.id) ? 'bg-blue-600 border-blue-500' : 'border-gray-600'}`}>
                                                {historySelection.has(s.id) && <Check size={14} className="text-white"/>}
                                            </div>
                                        )}
                                        <div className="flex-1">
                                            <div className="font-bold text-gray-300 text-sm flex items-center gap-2">
                                                {s.title || 'Untitled Session'}
                                                {s.mode === 'SELF_PACED' && <span className="text-[9px] border border-gray-700 px-1">SELF-PACED</span>}
                                            </div>
                                            <div className="text-[10px] text-gray-600">{new Date(s.createdAt).toLocaleDateString()}</div>
                                        </div>
                                        {!isSelectionMode && (
                                            <Button variant="ghost" onClick={(e) => { e.stopPropagation(); resumeSession(s.id); }} className="h-8 text-xs px-3 border border-gray-700">Results</Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // --- SETUP SCREEN ---
    if (viewMode === 'SETUP') {
        return (
            <div className="h-full w-full bg-gray-950 flex flex-col text-white">
                <div className="p-4 border-b border-gray-800 flex items-center gap-4 bg-gray-900 sticky top-0 z-30">
                    <button onClick={() => setViewMode('DASHBOARD')} className="p-2 bg-gray-800 rounded-full border border-gray-700 text-gray-400 hover:text-white"><ArrowLeft size={20}/></button>
                    <div><h2 className="text-xl font-bold">New Session</h2></div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Mode Selection */}
                    <div className="bg-gray-900 p-4 border border-gray-800">
                        <label className="text-xs text-gray-500 uppercase font-bold mb-3 block">Game Mode</label>
                        <div className="flex gap-2">
                            <button onClick={() => setSetupMode('LIVE')} className={`flex-1 p-4  border flex flex-col items-center gap-2 transition-all ${setupMode === 'LIVE' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-950 border-gray-800 text-gray-400'}`}>
                                <Zap size={24}/>
                                <span className="font-bold text-sm">Live Host</span>
                            </button>
                            <button onClick={() => setSetupMode('SELF_PACED')} className={`flex-1 p-4  border flex flex-col items-center gap-2 transition-all ${setupMode === 'SELF_PACED' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-gray-950 border-gray-800 text-gray-400'}`}>
                                <Clock size={24}/>
                                <span className="font-bold text-sm">Self-Paced</span>
                            </button>
                        </div>
                    </div>

                    {/* Self Paced Config */}
                    {setupMode === 'SELF_PACED' && (
                        <div className="bg-gray-900 p-4 border border-gray-800 space-y-4 animate-fade-in-up">
                            <div>
                                <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Session Name</label>
                                <input type="text" value={setupTitle} onChange={e => setSetupTitle(e.target.value)} placeholder="e.g. Weekly Challenge" className="w-full bg-gray-950 border border-gray-800 p-3 outline-none focus:border-purple-500"/>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Duration</label>
                                <select value={setupDuration} onChange={e => setSetupDuration(e.target.value)} className="w-full bg-gray-950 border border-gray-800 p-3 outline-none focus:border-purple-500">
                                    <option value="1">1 Hour</option>
                                    <option value="3">3 Hours</option>
                                    <option value="12">12 Hours</option>
                                    <option value="24">24 Hours</option>
                                    <option value="48">2 Days</option>
                                    <option value="168">7 Days</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Super Admin Settings */}
                    {userRole === 'super_admin' && (
                        <div className="bg-gray-900 p-4 border border-gray-800 space-y-4">
                            <label className="text-xs text-yellow-500 uppercase font-bold flex items-center gap-2">
                                <Lock size={12}/> Super Admin Features
                            </label>
                            
                            <div className="flex items-center justify-between p-3 bg-gray-950 border border-gray-800">
                                <div className="flex items-center gap-2">
                                    <Share2 size={18} className={shareConfigEnabled ? "text-blue-400" : "text-gray-500"} />
                                    <span className="text-sm font-bold text-white">Enable Social Share Card</span>
                                </div>
                                <input 
                                    type="checkbox" 
                                    checked={shareConfigEnabled}
                                    onChange={(e) => setShareConfigEnabled(e.target.checked)}
                                    className="w-5 h-5 accent-blue-500"
                                />
                            </div>

                            {shareConfigEnabled && (
                                <div>
                                    <label className="text-xs text-gray-500 uppercase block mb-1">Custom Background URL (Optional)</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={shareConfigBg}
                                            onChange={(e) => setShareConfigBg(e.target.value)}
                                            placeholder="https://..."
                                            className="w-full bg-gray-950 border border-gray-800 p-2 text-xs"
                                        />
                                        {shareConfigBg && <img src={shareConfigBg} className="w-8 h-8 object-cover border border-gray-700"/>}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Question Pack Selection */}
                    <div className="bg-gray-900 border border-gray-800 p-4 space-y-4">
                        <label className="text-xs text-gray-500 uppercase font-bold block">Question Pack</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(Object.keys(PRESET_PACKS) as Array<keyof typeof PRESET_PACKS>).map(key => (
                                <button key={key} onClick={() => setSelectedPack(key)} className={`p-3  border text-left text-sm font-bold ${selectedPack === key ? 'bg-blue-900/30 border-blue-500 text-blue-200' : 'bg-gray-950 border-gray-800 text-gray-400'}`}>
                                    {PRESET_PACKS[key].name}
                                </button>
                            ))}
                            <button onClick={() => fileInputRef.current?.click()} className={`p-3  border text-left text-sm font-bold flex items-center gap-2 ${selectedPack === 'CUSTOM' ? 'bg-purple-900/30 border-purple-500 text-purple-200' : 'bg-gray-950 border-gray-800 text-gray-400'}`}>
                                <Upload size={14}/> {customQuestions.length > 0 ? `${customQuestions.length} Custom Qs` : 'Upload JSON'}
                            </button>
                            
                            <button onClick={downloadTemplate} className="p-3 border text-left text-sm font-bold flex items-center gap-2 bg-gray-950 border-gray-800 text-gray-400 hover:text-white">
                                <Download size={14}/> Example JSON
                            </button>

                            <input type="file" ref={fileInputRef} accept=".json" className="hidden" onChange={handleFileUpload}/>
                        </div>

                        {/* Import/Export Pack Controls */}
                        <div className="pt-2 border-t border-gray-800 flex flex-col gap-2">
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={importCode}
                                    onChange={(e) => setImportCode(e.target.value)}
                                    placeholder="Enter Pack Code"
                                    className="flex-1 bg-gray-950 border border-gray-800 px-3 py-2 text-sm uppercase tracking-widest font-mono"
                                />
                                <Button variant="secondary" onClick={handleImportPack} className="h-auto py-2 text-xs">Import</Button>
                            </div>
                            {customQuestions.length > 0 && (
                                <Button variant="ghost" onClick={handleSharePack} className="text-xs border border-gray-700 h-8 flex items-center gap-2 justify-center">
                                    <Cloud size={14}/> Share Current Pack (Get Code)
                                </Button>
                            )}
                        </div>
                    </div>

                    <Button fullWidth onClick={createSession} className="bg-gradient-to-r from-blue-600 to-purple-600 h-14 text-lg mt-8">
                        Launch Session
                    </Button>
                </div>
            </div>
        );
    }

    // --- MONITOR VIEW (SELF PACED HOST) ---
    if (viewMode === 'MONITOR' && session) {
        const isExpired = session.expiresAt && Date.now() > session.expiresAt;
        const isActive = session.active;
        const top3 = players.slice(0, 3);
        
        return (
            <div className="h-full w-full bg-gray-950 flex flex-col text-white">
                <ConfirmationModal isOpen={showEndGameModal} onClose={() => setShowEndGameModal(false)} onConfirm={confirmEndGame} title="End Session?" message="This will move the session to history." confirmText="End Session" isDanger={true} />
                
                {/* PLAYER DETAIL MODAL */}
                <AnimatePresence>
                    {selectedPlayer && (
                        <MotionDiv 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 bg-black/95 flex flex-col"
                        >
                            <div className="p-4 border-b border-gray-800 flex items-center gap-4 bg-gray-900">
                                <button onClick={() => setSelectedPlayer(null)} className="p-2 rounded-full border border-gray-700"><ArrowLeft size={20}/></button>
                                <div><h3 className="font-bold text-lg">{selectedPlayer.name}</h3><p className="text-xs text-gray-500">Score: {selectedPlayer.score}</p></div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {session.questions.map((q, i) => {
                                    // Find answer
                                    const ans = selectedPlayer.answerHistory?.find(a => a.questionIndex === i);
                                    const hasAnswered = !!ans;
                                    const isCorrect = ans?.isCorrect;
                                    
                                    return (
                                        <div key={q.id} className="bg-gray-900 p-4 border border-gray-800">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="text-sm font-bold text-gray-300 pr-4">{i+1}. {q.text}</div>
                                                {hasAnswered ? (
                                                    isCorrect ? <CheckCircle size={18} className="text-green-500 shrink-0"/> : <X size={18} className="text-red-500 shrink-0"/>
                                                ) : (
                                                    <span className="text-[10px] text-gray-600 italic whitespace-nowrap">Not answered</span>
                                                )}
                                            </div>
                                            {hasAnswered && (
                                                <div className="text-xs text-gray-500 mt-2">
                                                    Selected: <span className="text-white font-bold">{q.options[ans!.selectedOption]}</span>
                                                    <br/>
                                                    Time: {ans!.timeTaken}s
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </MotionDiv>
                    )}
                </AnimatePresence>

                <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900 sticky top-0 z-30">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setViewMode('DASHBOARD')} className="p-2 bg-gray-800 rounded-full border border-gray-700 text-gray-400 hover:text-white"><ArrowLeft size={20}/></button>
                        <div>
                            <h2 className="text-lg font-bold flex items-center gap-2">{session.title} {isExpired && <span className="bg-red-500 text-[10px] px-1">EXPIRED</span>}</h2>
                            <p className="text-xs text-gray-500">{isActive ? 'Live Monitor' : 'Final Results'}</p>
                        </div>
                    </div>
                    {isActive && <Button variant="danger" onClick={() => setShowEndGameModal(true)} className="h-8 text-xs px-3">End</Button>}
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {/* Share Card (Only if active) */}
                    {isActive && (
                        <div className="bg-white p-4 flex flex-col items-center justify-center mb-6 shadow-2xl relative">
                            <QRCodeSVG value={constructJoinUrl()} size={250} includeMargin={true} />
                            <h3 className="text-black font-bold text-2xl mt-4">Scan to Join</h3>
                            <div className="flex gap-2 mt-4 mb-2">
                                <button 
                                    onClick={() => setShowQrModal(true)} 
                                    className="px-4 py-2 bg-gray-100 rounded-full text-xs font-bold text-gray-700 flex items-center gap-2 hover:bg-gray-200 transition-colors"
                                >
                                    <Maximize2 size={14}/> Fullscreen
                                </button>
                                <button 
                                    onClick={handleCopyLink} 
                                    className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-colors ${linkCopied ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'}`}
                                >
                                    {linkCopied ? <Check size={14}/> : <LinkIcon size={14}/>}
                                    {linkCopied ? 'Link Copied!' : 'Copy Link'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* PODIUM */}
                    {players.length > 0 && (
                        <div className="mb-8 flex justify-center items-end gap-2 h-40">
                            {/* 2nd Place */}
                            {top3[1] && (
                                <div className="flex flex-col items-center">
                                    <div className="text-xs font-bold text-gray-400 mb-1">{top3[1].name}</div>
                                    <div className="w-20 bg-gray-800 border-t-4 border-gray-400 h-24 flex flex-col items-center justify-center relative">
                                        <Medal size={24} className="text-gray-400 mb-1"/>
                                        <span className="font-black text-xl text-white">2</span>
                                        <span className="text-[10px] text-gray-500">{top3[1].score}</span>
                                    </div>
                                </div>
                            )}
                            
                            {/* 1st Place */}
                            {top3[0] && (
                                <div className="flex flex-col items-center z-10">
                                    <Crown size={24} className="text-yellow-400 mb-1 fill-yellow-400 animate-bounce"/>
                                    <div className="text-xs font-bold text-yellow-400 mb-1">{top3[0].name}</div>
                                    <div className="w-24 bg-gray-800 border-t-4 border-yellow-400 h-32 flex flex-col items-center justify-center relative shadow-lg shadow-yellow-900/20">
                                        <span className="font-black text-4xl text-white">1</span>
                                        <span className="text-xs text-yellow-500 font-bold">{top3[0].score}</span>
                                    </div>
                                </div>
                            )}

                            {/* 3rd Place */}
                            {top3[2] && (
                                <div className="flex flex-col items-center">
                                    <div className="text-xs font-bold text-gray-400 mb-1">{top3[2].name}</div>
                                    <div className="w-20 bg-gray-800 border-t-4 border-orange-700 h-20 flex flex-col items-center justify-center relative">
                                        <Medal size={24} className="text-orange-700 mb-1"/>
                                        <span className="font-black text-xl text-white">3</span>
                                        <span className="text-[10px] text-gray-500">{top3[2].score}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Leaderboard */}
                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><Activity size={14}/> Player Standings ({players.length})</h3>
                    <div className="space-y-2">
                        {players.length === 0 && <div className="text-center text-gray-600 py-10">No players yet.</div>}
                        {players.map((p, i) => {
                            const progress = Math.min(100, Math.round(((p.currentQuestionIndex || 0) / session.questions.length) * 100));
                            const isFinished = p.status === 'FINISHED';
                            return (
                                <div 
                                    key={p.id} 
                                    className="bg-gray-900 border border-gray-800 p-3 hover:border-gray-600 cursor-pointer transition-colors"
                                    onClick={() => setSelectedPlayer(p)}
                                >
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-3">
                                            <span className="text-gray-500 font-mono text-xs w-4">{i+1}</span>
                                            <div>
                                                <div className="font-bold text-white text-sm">{p.name}</div>
                                                <div className="text-[10px] text-gray-500 flex gap-2">
                                                    <span>Score: {p.score}</span>
                                                    {p.correctAnswersCount !== undefined && (
                                                        <span className="text-green-400">• {p.correctAnswersCount}/{session.questions.length} Correct</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {isFinished ? (
                                            <span className="text-[10px] bg-green-900 text-green-400 px-2 py-1 font-bold">DONE</span>
                                        ) : (
                                            <span className="text-[10px] text-blue-400">{progress}%</span>
                                        )}
                                    </div>
                                    {/* Progress Bar */}
                                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${progress}%` }}></div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        )
    }

    // --- Standard live game renderer (unchanged) ---
    // If we are in LOBBY or GAME mode (Live), render the controller
    if (viewMode === 'LOBBY' || viewMode === 'GAME') {
        const isLobby = viewMode === 'LOBBY';
        return (
            <div className="h-full w-full bg-gray-950 text-white flex flex-col overflow-hidden">
                <ConfirmationModal isOpen={showEndGameModal} onClose={() => setShowEndGameModal(false)} onConfirm={confirmEndGame} title="End Game?" message="End this live game?" confirmText="End Game" isDanger={true} />

                {/* Top Bar */}
                <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900 shrink-0 sticky top-0 z-50">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setViewMode('DASHBOARD')} className="p-2 rounded-full bg-gray-800 text-gray-400 hover:text-white"><ArrowLeft size={20}/></button>
                        <span className="font-bold text-gray-400 hidden md:inline">HOST SCREEN</span>
                        <span className="font-bold text-gray-400 md:hidden text-sm">TRIVIA HOST</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="danger" className="h-8 text-xs px-3" onClick={handleEndGameClick}>End Game</Button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto relative w-full bg-gray-900">
                    {isLobby ? renderLobby() : renderGameScreen()}
                </div>

                {/* QR MODAL */}
                <AnimatePresence>
                    {showQrModal && (
                        <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6" onClick={() => setShowQrModal(false)}>
                            <button onClick={() => setShowQrModal(false)} className="absolute top-6 right-6 p-2 bg-gray-800 rounded-full text-white"><X size={32} /></button>
                            <div className="bg-white p-6 flex flex-col items-center justify-center relative shadow-2xl" onClick={e => e.stopPropagation()}>
                                <QRCodeSVG value={constructJoinUrl()} size={window.innerWidth > 400 ? 350 : 250} includeMargin={true} />
                                <h3 className="text-black font-bold text-2xl mt-4">Scan to Join</h3>
                                <div className="mt-6 mb-2">
                                    <button onClick={handleCopyLink} className={`px-6 py-3 rounded-full text-sm font-bold flex items-center gap-2 transition-colors ${linkCopied ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'}`}>
                                        {linkCopied ? <Check size={16} /> : <LinkIcon size={16}/>} {linkCopied ? 'Link Copied!' : 'Copy Link'}
                                    </button>
                                </div>
                            </div>
                        </MotionDiv>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    return null; // Should not reach
};

// Simple icon for Reveal
const CheckCircle = ({size, className}: {size:number, className?:string}) => (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
)