
import React, { useState, useRef, useEffect } from 'react';
import { CodeItem, AppSettings, SessionData, UserRole } from '../types';
import { Button } from './Button';
import { Play, Upload, Trash2, Settings, Download, Plus, Share2, ArrowLeft, Eye, Copy, VenetianMask, Search, Radio, ExternalLink, FlaskConical, Gauge, Image as ImageIcon, Flame, Users, AlertTriangle, BarChart3, TrendingUp, Lock, ShieldAlert, Database, X, RefreshCw, LayoutGrid, LogOut, List, Check, PenLine, Zap, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
// @ts-ignore
import { doc, onSnapshot, getDocs, collection, deleteDoc, orderBy, query, limit, where, getDoc, collectionGroup } from 'firebase/firestore';
// @ts-ignore
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
// @ts-ignore
import { logEvent } from 'firebase/analytics';
import { db, analytics, auth } from '../firebase';
// @ts-ignore
import { useNavigate, useLocation } from 'react-router-dom';
import { ConfirmationModal } from './ConfirmationModal';
import { RecoveryRequestsManager } from './RecoveryRequestsManager';
import { DatabaseCleanup } from './DatabaseCleanup';
import { useToast } from './ToastContext';
import { useDiscordAuth } from './useDiscordAuth';

interface DashboardProps {
  codes: CodeItem[];
  onAddCodes: (rawText: string, preMarkedUsedData?: Record<string, any>) => void;
  onClearUsed: () => void;
  onClearAll: () => void;
  onDeleteCode: (id: string) => void;
  onEditCode: (id: string, newVal: string) => void;
  onToggleBadCode: (id: string) => void;
  onMarkBadCodes: (values: string[]) => void;
  onStart: () => void;
  settings: AppSettings;
  onUpdateSettings: (s: AppSettings) => void;
}

interface CommunityStats {
    name: string;
    sessions: number;
    codesGiven: number;
    reports: number;
    replacements: number;
}

interface SessionRecord extends SessionData {
    formattedDate: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  codes, 
  onAddCodes, 
  onClearUsed, 
  onClearAll, 
  onDeleteCode,
  onEditCode,
  onToggleBadCode,
  onMarkBadCodes,
  onStart,
  settings,
  onUpdateSettings
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  const { user: discordUser } = useDiscordAuth();
  const [inputText, setInputText] = useState('');
  const [viewState, setViewState] = useState<'HOME' | 'SETTINGS' | 'USED_LIST' | 'UNUSED_LIST' | 'ANALYTICS'>(
    (location.state as any)?.tab === 'RECOVERY_REQUESTS' ? 'ANALYTICS' : 'HOME'
  );
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isVerifyingCodes, setIsVerifyingCodes] = useState(false);
  const [indexErrorLink, setIndexErrorLink] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<{
    rawText: string,
    totalCount: number,
    redeemedCodesData: Record<string, any>,
    method: 'manual' | 'file'
  } | null>(null);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeSession, setActiveSession] = useState<{id: string, claimed: number, cap: number} | null>(null);
  
  const [analyticsData, setAnalyticsData] = useState<CommunityStats[]>([]);
  const [rawSessions, setRawSessions] = useState<SessionRecord[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<UserRole>('user');

  const [isAdminMode, setIsAdminMode] = useState(false);
  const [analyticsTab, setAnalyticsTab] = useState<'STATS' | 'DATA_MANAGER' | 'RECOVERY_REQUESTS'>(
    (location.state as any)?.tab === 'RECOVERY_REQUESTS' ? 'RECOVERY_REQUESTS' : 'STATS'
  );
  
  const [adminMenuVisible, setAdminMenuVisible] = useState(false);
  const [secretTaps, setSecretTaps] = useState(0);

  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [codeToDelete, setCodeToDelete] = useState<string | null>(null);
  const [showPermanentQr, setShowPermanentQr] = useState(false);

  useEffect(() => {
      const sessionId = localStorage.getItem('pogo_last_active_session');
      if (!sessionId) {
          setActiveSession(null);
          return;
      }

      const unsub = onSnapshot(doc(db, 'sessions', sessionId), (docSnap) => {
          if (docSnap.exists()) {
              const data = docSnap.data() as SessionData;
              if (data.active) {
                  setActiveSession({
                      id: sessionId,
                      claimed: data.claimedCount || 0,
                      cap: data.distributionCap || 0
                  });
              } else {
                  setActiveSession(null);
              }
          } else {
              setActiveSession(null);
          }
      });
      return () => unsub();
  }, []);

  useEffect(() => {
      const unsubAuth = onAuthStateChanged(auth, async (user: any) => {
          setCurrentUser(user);
          if(user) {
              setIsAdminMode(true);
              try {
                  const snap = await getDoc(doc(db, 'users', user.uid));
                  if (snap.exists()) {
                      const data = snap.data() as any;
                      const r = (data.role || 'user').toLowerCase();
                      setUserRole(r as UserRole);
                  }
              } catch (e) { console.error("Error fetching role", e); }
          } else {
              setIsAdminMode(false);
              setUserRole('user');
          }
      });
      return () => unsubAuth();
  }, []);

  const onStartSession = () => {
      onStart();
  };

  const unusedCount = codes.filter(c => !c.isUsed && !c.isReserved).length;
  const usedCodes = codes.filter(c => c.isUsed).sort((a,b) => (b.claimedAt || 0) - (a.claimedAt || 0));
  const usedCount = usedCodes.length;

  const verifyAndAddCodes = async (rawText: string, method: 'manual' | 'file') => {
    if (!rawText.trim()) return;
    
    setIsVerifyingCodes(true);
    try {
        // 1. Parse unique codes from input
        const rawList = rawText.split(/[\n,\s]+/).map(s => s.replace(/['"]/g, '').trim()).filter(s => s);
        const uniqueCodes = Array.from(new Set(rawList));
        
        if (uniqueCodes.length === 0) {
            setIsVerifyingCodes(false);
            return;
        }

        // 2. Batch query Firestore (max 30 per 'in' query)
        const redeemedFoundData: Record<string, any> = {};
        const chunkSize = 30;
        
        for (let i = 0; i < uniqueCodes.length; i += chunkSize) {
            const chunk = uniqueCodes.slice(i, i + chunkSize);
            const codesQuery = query(
                collectionGroup(db, 'codes'),
                where('value', 'in', chunk)
            );
            
            const snap = await getDocs(codesQuery);
            snap.forEach(doc => {
                const data = doc.data();
                if (data.claimed === true) {
                    redeemedFoundData[data.value] = data;
                }
            });
        }
        
        const redeemedKeys = Object.keys(redeemedFoundData);

        // 3. If we found redeemed codes, show the modal
        if (redeemedKeys.length > 0) {
            setVerificationResult({
                rawText,
                totalCount: uniqueCodes.length,
                redeemedCodesData: redeemedFoundData,
                method
            });
        } else {
            // No redeemed codes found, just add them normally
            onAddCodes(rawText);
            if (analytics) logEvent(analytics, 'add_codes', { method });
            if (method === 'manual') setInputText('');
            addToast(`Successfully added ${uniqueCodes.length} codes.`, 'success');
        }
    } catch (error: any) {
        console.error("Error verifying codes:", error);
        setIsVerifyingCodes(false);
        
        const errorMessage = error.message || String(error);
        const linkMatch = errorMessage.match(/(https:\/\/console\.firebase\.google\.com[^\s]+)/);
        
        if (linkMatch && errorMessage.includes('index')) {
            setIndexErrorLink(linkMatch[0]);
            return; // Stop here, don't fallback to adding codes
        }

        // Fallback: just add them if verification fails
        onAddCodes(rawText);
        if (analytics) logEvent(analytics, 'add_codes', { method });
        if (method === 'manual') setInputText('');
        addToast(`Verification skipped: ${errorMessage}`, 'warning');
    } finally {
        setIsVerifyingCodes(false);
    }
  };

  const handleAdd = () => {
    verifyAndAddCodes(inputText, 'manual');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        verifyAndAddCodes(text, 'file');
      };
      reader.readAsText(file);
    }
  };

  const exportUnused = () => {
    const unused = codes.filter(c => !c.isUsed && !c.isReserved).map(c => c.value).join('\n');
    const blob = new Blob([unused], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unused_codes_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    if (analytics) logEvent(analytics, 'export_codes');
  };

  const exportUsed = () => {
    const csv = "Code,Claimed At,Claimed By,Source,Status\n" + 
        usedCodes.map(c => 
            `${c.value},${c.claimedAt ? new Date(c.claimedAt).toLocaleString() : 'Unknown'},${c.claimedByIgn || 'Anonymous'},${c.source || 'direct_scan'},${c.isBadCode ? 'Bad Code' : 'Valid'}`
        ).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `redeemed_codes_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const handleShareApp = async () => {
    const url = window.location.href.split('#')[0]; 
    const shareData = {
        title: 'CA Meetup +',
        text: 'I use this tool to distribute Pokémon GO codes. It handles the queue automatically!',
        url: url
    };
    
    if (navigator.share) {
        try { await navigator.share(shareData); } catch (e) { /* ignore */ }
    } else {
        navigator.clipboard.writeText(url);
        addToast('App Link copied to clipboard!', 'success');
    }
    if (analytics) logEvent(analytics, 'share_app');
  };

  const handleAnalyticsAuth = async () => {
      setAuthLoading(true);
      try {
          await signInWithEmailAndPassword(auth, emailInput, passwordInput);
          setViewState('ANALYTICS');
          setShowAuthModal(false);
          setEmailInput('');
          setPasswordInput('');
      } catch (e: any) {
          addToast("Login failed: " + e.message, 'error');
      } finally {
          setAuthLoading(false);
      }
  };
  
  const handleSignOut = async () => {
      await signOut(auth);
      setViewState('HOME');
      setIsAdminMode(false);
  };

  const handleMyStats = () => {
      setIsAdminMode(false);
      fetchAnalytics(false);
      setViewState('ANALYTICS');
      setShowAuthModal(false);
  };

  const handleSecretTap = () => {
      const newCount = secretTaps + 1;
      setSecretTaps(newCount);
      if (newCount >= 5) {
          setAdminMenuVisible(true);
          if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
      }
  };

  const fetchAnalytics = async (globalMode: boolean) => {
      setLoadingAnalytics(true);
      const myDeviceId = localStorage.getItem('pogo_device_id');
      const myCommunityName = settings.ambassador.communityName || 'Unknown Community';

      try {
          let q;
          const canViewGlobal = globalMode && userRole === 'super_admin';

          if (canViewGlobal) {
               q = query(collection(db, 'sessions'), orderBy('createdAt', 'desc'), limit(100));
          } else {
              if (myDeviceId) {
                  q = query(collection(db, 'sessions'), where("hostDevice", "==", myDeviceId), limit(100));
              } else {
                  setAnalyticsData([]);
                  setRawSessions([]);
                  setLoadingAnalytics(false);
                  return;
              }
          }

          const snap = await getDocs(q);
          const statsMap: Record<string, CommunityStats> = {};
          const sessionRecords: SessionRecord[] = [];
          
          snap.forEach(docSnap => {
              const data = docSnap.data() as SessionData;
              if (data.isTestSession && !canViewGlobal) return; 

              sessionRecords.push({ ...data, id: docSnap.id, formattedDate: data.createdAt ? new Date((data.createdAt as any).seconds * 1000).toLocaleDateString() : 'N/A' });

              let communityName = data.ambassador?.communityName || 'Unknown Community';
              if (data.hostDevice === myDeviceId) communityName = myCommunityName;
              
              if (!statsMap[communityName]) {
                  statsMap[communityName] = { name: communityName, sessions: 0, codesGiven: 0, reports: 0, replacements: 0 };
              }
              
              statsMap[communityName].sessions += 1;
              statsMap[communityName].codesGiven += (data.claimedCount || 0);
              statsMap[communityName].reports += (data.reportCount || 0);
              statsMap[communityName].replacements += (data.replacementCount || 0);
          });
          
          sessionRecords.sort((a, b) => {
              const tA = (a.createdAt as any)?.seconds || 0;
              const tB = (b.createdAt as any)?.seconds || 0;
              return tB - tA;
          });

          setAnalyticsData(Object.values(statsMap).sort((a,b) => b.codesGiven - a.codesGiven));
          setRawSessions(sessionRecords);

      } catch (e) { console.error(e); }
      finally { setLoadingAnalytics(false); }
  };

  const handleDeleteSession = (sessionId: string) => {
      setSessionToDelete(sessionId);
  };

  const confirmDeleteSession = async () => {
      if (!sessionToDelete) return;
      try {
          await deleteDoc(doc(db, 'sessions', sessionToDelete));
          setRawSessions(prev => prev.filter(s => s.id !== sessionToDelete));
      } catch (e) { addToast("Error deleting session.", 'error'); }
  };

  const initiateEdit = (code: CodeItem) => {
      setEditingId(code.id);
      setEditValue(code.value);
  };

  const saveEdit = (id: string) => {
      if (editValue.trim()) {
          onEditCode(id, editValue.trim());
          setEditingId(null);
          setEditValue('');
      }
  };

  const initiateDelete = (id: string) => {
      setCodeToDelete(id);
  };

  const confirmDeleteCode = () => {
      if (codeToDelete) {
          onDeleteCode(codeToDelete);
          setCodeToDelete(null);
      }
  };

  const renderAuthModal = () => (
    showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 p-6 w-full max-w-sm">
                <div className="flex justify-between items-center mb-6">
                    <h3 onClick={handleSecretTap} className="text-sm font-bold text-gray-400 select-none cursor-pointer active:translate-y-1 active:translate-x-1 transition-transform p-2 -m-2 uppercase tracking-wider">
                        Analytics Access
                    </h3>
                    <button onClick={() => { setShowAuthModal(false); setSecretTaps(0); }}><X className="text-gray-500"/></button>
                </div>
                
                <div className="space-y-4">
                    <button onClick={handleMyStats} className="w-full bg-gray-800 hover:bg-gray-700 p-4 flex items-center gap-4 text-left transition-colors">
                        <div className="bg-blue-500/20 p-2 rounded-full"><Users className="text-blue-400"/></div>
                        <div><div className="font-bold text-white">View My Stats</div><div className="text-xs text-gray-400">See usage for this device only</div></div>
                    </button>
                    {(adminMenuVisible || (currentUser && userRole === 'super_admin')) && (
                        <div className="animate-fade-in-up">
                            <div className="relative my-4"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-800"></div></div><div className="relative flex justify-center"><span className="bg-gray-900 px-2 text-xs text-gray-500">OR</span></div></div>
                            <div className="bg-gray-900 p-4 border border-gray-800">
                                <label className="text-xs text-gray-400 font-bold uppercase mb-2 block flex items-center gap-2"><Lock size={12}/> Super Admin Access</label>
                                {currentUser ? (
                                    <div>
                                        <div className="text-xs text-green-400 mb-2">Logged in as {currentUser.email}</div>
                                        {userRole === 'super_admin' ? (
                                            <Button fullWidth onClick={() => { fetchAnalytics(true); setViewState('ANALYTICS'); setShowAuthModal(false); }} variant="primary" className="h-10 text-sm mb-2">Open Global Data</Button>
                                        ) : null}
                                        <Button fullWidth onClick={() => signOut(auth)} variant="secondary" className="h-8 text-xs">Sign Out</Button>
                                    </div>
                                ) : (
                                    <>
                                        <input type="email" placeholder="Admin Email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="w-full bg-gray-900 border border-gray-700 p-3 mb-2 focus:border-primary outline-none text-sm" />
                                        <input type="password" placeholder="Password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full bg-gray-900 border border-gray-700 p-3 mb-3 focus:border-primary outline-none text-sm" />
                                        <Button fullWidth onClick={handleAnalyticsAuth} variant="primary" className="h-10 text-sm" disabled={authLoading}>{authLoading ? 'Logging in...' : 'Unlock Global Data'}</Button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
  );

  if (viewState === 'ANALYTICS') {
      return (
        <div className="flex flex-col h-full bg-gray-950 text-white">
            <ConfirmationModal isOpen={!!sessionToDelete} onClose={() => setSessionToDelete(null)} onConfirm={confirmDeleteSession} title="Delete Session Record?" message={`Are you sure you want to PERMANENTLY delete session ${sessionToDelete}? This cannot be undone.`} confirmText="Yes, Delete Forever" isDanger={true} />
            <div className="p-4 border-b border-gray-800 flex items-center gap-4 bg-gray-900 sticky top-0 z-30">
                <button onClick={() => setViewState('SETTINGS')} className="p-2 bg-gray-800 rounded-full border border-gray-700 text-gray-400 hover:text-white"><ArrowLeft size={20}/></button>
                <div className="flex-1"><h2 className="text-xl font-bold">{userRole === 'super_admin' ? 'Global Analytics' : 'My Statistics'}</h2><p className="text-xs text-gray-500">{userRole === 'super_admin' ? 'Super Admin Access' : 'Local Device Data'}</p></div>
                <div className="flex gap-2">
                    {currentUser && <button onClick={handleSignOut} className="p-2 bg-gray-800 rounded-full border border-gray-700 hover:text-red-400" title="Sign Out"><LogOut size={20}/></button>}
                    <button onClick={() => fetchAnalytics(userRole === 'super_admin')} className="p-2 bg-gray-800 rounded-full text-primary hover:bg-gray-700"><RefreshCw size={20} className={loadingAnalytics ? 'animate-spin' : ''}/></button>
                </div>
            </div>
            {isAdminMode && userRole === 'super_admin' && (
                <div className="flex border-b border-gray-800 bg-gray-900/50">
                    <button onClick={() => setAnalyticsTab('STATS')} className={`flex-1 py-3 text-sm font-bold border-b-2 ${analyticsTab === 'STATS' ? 'border-primary text-white' : 'border-transparent text-gray-500'}`}>Metrics</button>
                    <button onClick={() => setAnalyticsTab('DATA_MANAGER')} className={`flex-1 py-3 text-sm font-bold border-b-2 ${analyticsTab === 'DATA_MANAGER' ? 'border-primary text-white' : 'border-transparent text-gray-500'}`}>Data Manager</button>
                    <button onClick={() => setAnalyticsTab('RECOVERY_REQUESTS')} className={`flex-1 py-3 text-sm font-bold border-b-2 ${analyticsTab === 'RECOVERY_REQUESTS' ? 'border-primary text-white' : 'border-transparent text-gray-500'}`}>Recovery</button>
                </div>
            )}
            <div className="flex-1 overflow-y-auto p-4">
                {loadingAnalytics ? (
                    <div className="text-center text-gray-500 mt-20 animate-pulse">Crunching numbers...</div>
                ) : (
                    <>
                    {analyticsTab === 'STATS' && (
                        <div className="space-y-6">
                            <div className="bg-gradient-to-br from-primary to-orange-600 p-6 shadow-lg">
                                <h3 className="text-white/80 font-bold uppercase text-xs tracking-wider mb-1">Total Codes Distributed</h3>
                                <div className="text-5xl font-bold text-white">{analyticsData.reduce((sum, item) => sum + item.codesGiven, 0).toLocaleString()}</div>
                            </div>
                            <div className="bg-gray-900 border border-gray-800 overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-800 text-gray-400 uppercase text-xs font-bold"><tr><th className="p-3">Community</th><th className="p-3 text-center">Sessions</th><th className="p-3 text-right">Codes</th><th className="p-3 text-right">Issues</th></tr></thead>
                                    <tbody className="divide-y divide-gray-800">
                                        {analyticsData.length === 0 ? (<tr><td colSpan={4} className="p-6 text-center text-gray-500">No data found.</td></tr>) : (
                                            analyticsData.map(stat => (
                                                <tr key={stat.name} className="hover:bg-gray-800/50">
                                                    <td className="p-3 font-bold">{stat.name}</td>
                                                    <td className="p-3 text-center text-gray-400">{stat.sessions}</td>
                                                    <td className="p-3 text-right text-primary font-mono font-bold">{stat.codesGiven}</td>
                                                    <td className="p-3 text-right text-red-400">
                                                        {stat.reports > 0 ? (
                                                            <div className="flex flex-col items-end"><span>{stat.reports}</span><span className="text-[9px] text-gray-500">{((stat.reports / stat.codesGiven)*100).toFixed(1)}%</span></div>
                                                        ) : '-'}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    {analyticsTab === 'DATA_MANAGER' && isAdminMode && userRole === 'super_admin' && (
                        <div className="space-y-4">
                             <div className="text-center text-gray-500">Admin Data Tools</div>
                             
                             <DatabaseCleanup />

                             <div className="mt-8 mb-2 font-bold text-white">Session History</div>
                             {rawSessions.map(session => (
                                <div key={session.id} className="bg-gray-900 p-4 border border-gray-800 flex flex-col gap-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-bold text-white flex items-center gap-2">{session.ambassador?.communityName || 'Unknown'}{session.isTestSession && <span className="bg-yellow-500 text-black text-[9px] px-1">TEST</span>}</div>
                                            <div className="text-xs text-gray-500 font-mono">{session.id.slice(0,8)}... • {session.formattedDate}</div>
                                        </div>
                                        <div className="text-right"><div className="text-primary font-bold">{session.claimedCount} codes</div></div>
                                    </div>
                                    <div className="flex justify-end pt-2 border-t border-gray-800 mt-2">
                                        <button onClick={() => handleDeleteSession(session.id)} className="text-red-400 text-xs flex items-center gap-1 hover:text-red-300"><Trash2 size={12} /> Delete Session</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {analyticsTab === 'RECOVERY_REQUESTS' && isAdminMode && userRole === 'super_admin' && (
                        <div className="space-y-4">
                             <div className="text-center text-gray-500 mb-4">Data Recovery Requests</div>
                             <RecoveryRequestsManager />
                        </div>
                    )}
                    </>
                )}
            </div>
        </div>
      );
  }

  if (viewState === 'SETTINGS') {
    return (
        <div className="flex flex-col h-full bg-gray-950 text-white">
            <div className="p-4 border-b border-gray-800 flex items-center gap-4 bg-gray-900 sticky top-0 z-30">
                <button onClick={() => setViewState('HOME')} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white border border-gray-700"><ArrowLeft size={20}/></button>
                <div><h2 className="text-xl font-bold">Distributor Settings</h2><p className="text-xs text-gray-500">Queue configuration & controls</p></div>
            </div>
            {renderAuthModal()}
            <div className="p-6 overflow-y-auto pb-24 space-y-4">
                <div>
                    <label className="block text-sm text-gray-400 mb-1">Session Distribution Cap</label>
                    <input type="number" min="0" placeholder="Unlimited" value={settings.distributionCap === 0 ? '' : settings.distributionCap} onChange={(e) => { const val = e.target.value; onUpdateSettings({...settings, distributionCap: val === '' ? 0 : Math.max(0, parseInt(val))}); }} className="w-full bg-gray-900 border border-gray-800 p-3 focus:border-primary outline-none" />
                    <p className="text-xs text-gray-500 mt-1">Leave empty or 0 for unlimited codes.</p>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-900 border border-gray-800">
                    <div className="flex items-center gap-2"><Gauge size={20} className={settings.removeDailyLimit ? "text-orange-400" : "text-gray-400"} /><div className="flex-1"><span className={settings.removeDailyLimit ? "text-white font-bold" : "text-gray-300"}>Remove Daily Limit</span><div className="text-[10px] text-gray-500 leading-tight mt-0.5">Allow users to scan multiple times per session.</div></div></div>
                    <input type="checkbox" checked={settings.removeDailyLimit || false} onChange={(e) => onUpdateSettings({...settings, removeDailyLimit: e.target.checked})} className="w-5 h-5 accent-orange-400" />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-900 border border-gray-800">
                    <div className="flex items-center gap-2"><VenetianMask size={20} className={settings.blockIncognito ? "text-red-400" : "text-gray-400"} /><div><span className={settings.blockIncognito ? "text-white font-bold" : "text-gray-300"}>Block Incognito</span><div className="text-[10px] text-gray-500">Prevent Private Mode access</div></div></div>
                    <input type="checkbox" checked={settings.blockIncognito || false} onChange={(e) => onUpdateSettings({...settings, blockIncognito: e.target.checked})} className="w-5 h-5 accent-red-400" />
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-900 border border-gray-800">
                    <div className="flex items-center gap-2"><FlaskConical size={20} className={settings.testMode ? "text-yellow-400" : "text-gray-400"} /><div><span className={settings.testMode ? "text-white font-bold" : "text-gray-300"}>Test Mode</span><div className="text-[10px] text-gray-500">Simulate distribution (Fake codes)</div></div></div>
                    <input type="checkbox" checked={settings.testMode || false} onChange={(e) => onUpdateSettings({...settings, testMode: e.target.checked})} className="w-5 h-5 accent-yellow-400" />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-900"><span>Haptic Vibration</span><input type="checkbox" checked={settings.vibration} onChange={(e) => onUpdateSettings({...settings, vibration: e.target.checked})} className="w-5 h-5 accent-primary" /></div>
                <div>
                    <label className="block text-sm text-gray-400 mb-1 flex items-center gap-2"><AlertTriangle size={16} className="text-yellow-400" /> PoGO Limit Warning</label>
                    <textarea maxLength={200} rows={3} placeholder="PoGO restricts accounts..." value={settings.ambassador.limitWarning || ''} onChange={(e) => onUpdateSettings({...settings, ambassador: { ...settings.ambassador, limitWarning: e.target.value }})} className="w-full bg-gray-900 border border-gray-800 p-3 focus:border-primary outline-none resize-none text-sm" />
                </div>
                <button onClick={() => setShowAuthModal(true)} className="w-full flex items-center justify-between p-4 bg-gray-900 border border-gray-800 hover:border-gray-600 transition-colors"><div className="flex items-center gap-3"><BarChart3 size={20} className="text-blue-400" /><span className="font-bold text-white">Community Metrics</span></div><ArrowLeft size={16} className="rotate-180 text-gray-400" /></button>
            </div>
            <div className="mt-auto p-4 bg-gray-950 border-t border-gray-900"><Button fullWidth onClick={() => setViewState('HOME')}>Save & Back</Button></div>
        </div>
    )
  }

    const handleScanPastSessions = async () => {
        setLoadingAnalytics(true);
        try {
            const sessionsSnap = await getDocs(collection(db, 'sessions'));
            const badCodesFound = new Set<string>();
            
            for (const sessionDoc of sessionsSnap.docs) {
                const reportsSnap = await getDocs(collection(db, `sessions/${sessionDoc.id}/reports`));
                reportsSnap.forEach(reportDoc => {
                    const data = reportDoc.data();
                    if (data.badCode && data.status === 'resolved') {
                        badCodesFound.add(data.badCode);
                    }
                });
            }
            
            if (badCodesFound.size > 0) {
                onMarkBadCodes(Array.from(badCodesFound));
                addToast(`Found and marked ${badCodesFound.size} bad codes from past sessions!`, 'success');
            } else {
                addToast('No past bad codes found in your history.', 'info');
            }
        } catch (e) {
            console.error(e);
            addToast('Failed to scan past sessions.', 'error');
        } finally {
            setLoadingAnalytics(false);
        }
    };

  if (viewState === 'USED_LIST') {
      const filteredUsed = usedCodes.filter(c => c.value.toLowerCase().includes(searchQuery.toLowerCase()));
      return (
        <div className="flex flex-col h-full bg-gray-950 text-white">
            <div className="p-4 border-b border-gray-800 flex items-center gap-4 bg-gray-900 sticky top-0 z-30">
                <button onClick={() => setViewState('HOME')} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white border border-gray-700"><ArrowLeft size={20}/></button>
                <h2 className="text-xl font-bold">Redeemed Codes</h2>
            </div>
            <div className="p-4 bg-gray-900 border-b border-gray-800">
                <div className="flex items-center gap-2 bg-gray-950 p-3 border border-gray-800 mb-3">
                    <Search size={18} className="text-gray-400"/><input type="text" placeholder="Search code..." className="bg-transparent outline-none w-full text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" fullWidth onClick={exportUsed} icon={<Download size={16}/>} className="text-xs h-10">Download (CSV)</Button>
                    {userRole === 'super_admin' && (
                        <Button variant="secondary" fullWidth onClick={handleScanPastSessions} disabled={loadingAnalytics} icon={<AlertTriangle size={16}/>} className="text-xs h-10">{loadingAnalytics ? 'Scanning...' : 'Find Bad Codes'}</Button>
                    )}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {filteredUsed.length === 0 ? (<div className="text-center text-gray-500 mt-10">No codes found.</div>) : (
                    filteredUsed.map(code => (
                        <div key={code.id} className="bg-gray-900 p-4 border border-gray-800 flex justify-between items-center group">
                            <div className="flex-1 min-w-0 pr-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className={`font-mono font-bold truncate ${code.isBadCode ? 'text-red-400 line-through opacity-70' : 'text-gray-200'}`}>{code.value}</div>
                                    {code.source === 'raffle_win' ? (
                                        <span className="bg-blue-900/40 text-blue-400 text-[8px] font-black uppercase px-1.5 py-0.5 border border-blue-500/30 flex items-center gap-1 shrink-0">
                                            <Zap size={8} fill="currentColor"/> Raffle
                                        </span>
                                    ) : (
                                        <span className="bg-gray-800 text-gray-500 text-[8px] font-bold uppercase px-1.5 py-0.5 border border-gray-700 flex items-center gap-1 shrink-0">
                                            <QrCode size={8}/> Scan
                                        </span>
                                    )}
                                    {code.isBadCode && (
                                        <span className="bg-red-500 text-white text-[8px] font-black uppercase px-1.5 py-0.5 border border-red-600 flex items-center gap-1 shrink-0">
                                            Bad Code
                                        </span>
                                    )}
                                </div>
                                <div className="text-[10px] text-gray-500 mb-1">{code.claimedAt ? new Date(code.claimedAt).toLocaleString() : 'Unknown Time'}</div>
                                {code.claimedByIgn && (
                                    <div className="text-xs text-primary font-bold flex items-center gap-1 truncate"><Users size={10}/> {code.claimedByIgn}</div>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => onToggleBadCode(code.id)} className={`p-3  transition-all border ${code.isBadCode ? 'bg-red-900/20 text-red-400 border-red-500/30 hover:bg-red-900/40' : 'bg-gray-950 text-gray-400 border-gray-800 hover:text-red-400 hover:border-red-400'}`} title={code.isBadCode ? 'Mark as Valid' : 'Mark as Bad Code'}><AlertTriangle size={16} /></button>
                                <button onClick={() => {navigator.clipboard.writeText(code.value); addToast('Copied to clipboard!', 'success');}} className="p-3 bg-gray-950 text-gray-400 hover:text-primary border border-gray-800 hover:border-primary transition-all"><Copy size={16} /></button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
      )
  }

  if (viewState === 'UNUSED_LIST') {
      const unusedCodes = codes.filter(c => !c.isUsed && c.value.toLowerCase().includes(searchQuery.toLowerCase()));
      return (
        <div className="flex flex-col h-full bg-gray-950 text-white">
            <ConfirmationModal isOpen={!!codeToDelete} onClose={() => setCodeToDelete(null)} onConfirm={confirmDeleteCode} title="Delete Code?" message="Are you sure you want to remove this code from the list?" confirmText="Yes, Delete" isDanger={true} />
            <div className="p-4 border-b border-gray-800 flex items-center gap-4 bg-gray-900 sticky top-0 z-30"><button onClick={() => setViewState('HOME')} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white border border-gray-700"><ArrowLeft size={20}/></button><h2 className="text-xl font-bold">Unused Codes</h2></div>
            <div className="p-4 bg-gray-900 border-b border-gray-800">
                <div className="flex items-center gap-2 bg-gray-950 p-3 border border-gray-800 mb-3"><Search size={18} className="text-gray-400"/><input type="text" placeholder="Search code..." className="bg-transparent outline-none w-full text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/></div>
                <Button variant="secondary" fullWidth onClick={exportUnused} icon={<Download size={16}/>} className="text-xs h-10">Download List (TXT)</Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {unusedCodes.length === 0 ? (<div className="text-center text-gray-500 mt-10">No codes found.</div>) : (
                    unusedCodes.map(code => (
                        <div key={code.id} className="bg-gray-900 p-3 border border-gray-800 flex justify-between items-center gap-2 group hover:border-gray-700 transition-colors">
                            {editingId === code.id ? (
                                <div className="flex-1 flex gap-2"><input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="flex-1 bg-gray-950 border border-primary px-2 py-1 text-sm font-mono outline-none" autoFocus /><button onClick={() => saveEdit(code.id)} className="p-2 bg-green-500/20 text-green-500 hover:bg-green-500/30"><Check size={16}/></button><button onClick={() => setEditingId(null)} className="p-2 bg-gray-800 text-gray-400 hover:text-white"><X size={16}/></button></div>
                            ) : (
                                <>
                                    <div className="flex-1 font-mono font-bold text-gray-200 truncate flex items-center gap-2">
                                        {code.value}
                                        {code.isReserved && <span className="bg-blue-900/40 text-blue-400 text-[8px] font-black uppercase px-1.5 py-0.5 border border-blue-500/30">Reserved</span>}
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => {navigator.clipboard.writeText(code.value); addToast('Copied to clipboard!', 'success');}} className="p-2 text-gray-500 hover:text-primary hover:bg-gray-800" title="Copy"><Copy size={16} /></button>
                                        <button onClick={() => initiateEdit(code)} className="p-2 text-gray-500 hover:text-blue-400 hover:bg-gray-800" title="Edit"><PenLine size={16} /></button>
                                        <button onClick={() => initiateDelete(code.id)} className="p-2 text-gray-500 hover:text-red-400 hover:bg-gray-800" title="Delete"><Trash2 size={16} /></button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
      )
  }

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white">
      {renderAuthModal()}
      
      {isVerifyingCodes && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 p-6 max-w-sm w-full text-center">
                <RefreshCw size={40} className="text-primary animate-spin mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Verifying Codes...</h3>
                <p className="text-sm text-gray-400">Checking global database for previously redeemed codes.</p>
            </div>
        </div>
      )}

      {indexErrorLink && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 p-6 max-w-md w-full">
                <div className="flex items-center gap-3 text-blue-400 mb-4">
                    <Database size={24} />
                    <h3 className="text-xl font-bold text-white">Database Setup Required</h3>
                </div>
                <p className="text-sm text-gray-300 mb-4">
                    To search across all your sessions for redeemed codes, Firebase requires a specific database index to be built. This is a one-time setup.
                </p>
                <ol className="text-sm text-gray-400 list-decimal list-inside space-y-2 mb-6">
                    <li>Click the button below to open your Firebase Console.</li>
                    <li>Click <strong>"Create"</strong> on the popup that appears.</li>
                    <li>Wait 3-5 minutes for the status to change to <strong>"Enabled"</strong>.</li>
                    <li>Come back here and try adding your codes again!</li>
                </ol>
                <div className="space-y-3">
                    <a 
                        href={indexErrorLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 font-medium transition-colors"
                        onClick={() => setIndexErrorLink(null)}
                    >
                        Create Index in Firebase <ExternalLink size={16} />
                    </a>
                    <Button 
                        fullWidth 
                        variant="ghost"
                        onClick={() => setIndexErrorLink(null)}
                    >
                        Cancel
                    </Button>
                </div>
            </div>
        </div>
      )}

      {verificationResult && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 p-6 max-w-md w-full">
                <div className="flex items-center gap-3 text-yellow-500 mb-4">
                    <AlertTriangle size={24} />
                    <h3 className="text-xl font-bold text-white">Redeemed Codes Found</h3>
                </div>
                <p className="text-sm text-gray-300 mb-4">
                    We found <strong className="text-white">{Object.keys(verificationResult.redeemedCodesData).length}</strong> codes out of the <strong className="text-white">{verificationResult.totalCount}</strong> you uploaded that have already been redeemed in the past.
                </p>
                <div className="bg-gray-950 border border-gray-800 p-3 max-h-32 overflow-y-auto mb-6 custom-scrollbar">
                    <div className="text-xs font-mono text-gray-500">
                        {Object.keys(verificationResult.redeemedCodesData).slice(0, 10).map(c => <div key={c}>{c}</div>)}
                        {Object.keys(verificationResult.redeemedCodesData).length > 10 && <div className="text-yellow-500 mt-1">...and {Object.keys(verificationResult.redeemedCodesData).length - 10} more</div>}
                    </div>
                </div>
                
                <div className="space-y-3">
                    <Button 
                        fullWidth 
                        onClick={() => {
                            // Skip redeemed
                            const rawList = verificationResult.rawText.split(/[\n,\s]+/).map(s => s.replace(/['"]/g, '').trim()).filter(s => s);
                            const redeemedSet = new Set(Object.keys(verificationResult.redeemedCodesData));
                            const filteredList = rawList.filter(c => !redeemedSet.has(c));
                            
                            onAddCodes(filteredList.join('\n'));
                            if (analytics) logEvent(analytics, 'add_codes', { method: verificationResult.method, action: 'skip_redeemed' });
                            if (verificationResult.method === 'manual') setInputText('');
                            addToast(`Added ${filteredList.length} unused codes. Skipped ${Object.keys(verificationResult.redeemedCodesData).length}.`, 'success');
                            setVerificationResult(null);
                        }}
                    >
                        Skip Redeemed (Recommended)
                    </Button>
                    <Button 
                        fullWidth 
                        variant="secondary"
                        onClick={() => {
                            // Add as redeemed
                            onAddCodes(verificationResult.rawText, verificationResult.redeemedCodesData);
                            if (analytics) logEvent(analytics, 'add_codes', { method: verificationResult.method, action: 'add_as_redeemed' });
                            if (verificationResult.method === 'manual') setInputText('');
                            addToast(`Added ${verificationResult.totalCount} codes (${Object.keys(verificationResult.redeemedCodesData).length} pre-marked as redeemed).`, 'success');
                            setVerificationResult(null);
                        }}
                    >
                        Add & Mark as Redeemed
                    </Button>
                    <div className="flex gap-3 pt-2 border-t border-gray-800">
                        <Button 
                            variant="danger" 
                            className="flex-1 text-xs"
                            onClick={() => {
                                // Force add all
                                onAddCodes(verificationResult.rawText);
                                if (analytics) logEvent(analytics, 'add_codes', { method: verificationResult.method, action: 'force_add_all' });
                                if (verificationResult.method === 'manual') setInputText('');
                                addToast(`Force added all ${verificationResult.totalCount} codes.`, 'warning');
                                setVerificationResult(null);
                            }}
                        >
                            Force Add All
                        </Button>
                        <Button 
                            variant="ghost" 
                            className="flex-1 text-xs"
                            onClick={() => setVerificationResult(null)}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {showPermanentQr && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6 flex-col">
            <div className="bg-white p-8 shadow-2xl mb-8 relative">
                <div className="absolute -top-4 -left-4 bg-primary text-gray-900 text-[10px] font-black tracking-widest uppercase px-3 py-1 shadow-lg transform -rotate-2">Printed / Static</div>
                <QRCodeSVG 
                    value={`${window.location.origin}/#/a/${discordUser?.id || currentUser?.uid || localStorage.getItem('pogo_device_id') || 'host'}`} 
                    size={250} 
                    level="H"
                />
            </div>
            
            <div className="max-w-xs text-center space-y-4">
                <h3 className="text-xl font-bold uppercase italic text-primary">Your Permanent QR Code</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                    Print this QR code. It will <b className="text-gray-200">automatically route</b> players to your active Session when one is running!
                </p>
                <p className="text-[10px] text-gray-500 bg-gray-900 border border-gray-800 p-3 text-left">
                    If no session is running, players will see a "No active event" message and your community link.
                </p>
                
                <div className="pt-4 flex gap-3">
                    <Button fullWidth variant="secondary" onClick={() => setShowPermanentQr(false)}>Close</Button>
                </div>
            </div>
        </div>
      )}

      <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900 sticky top-0 z-30">
        <div className="flex items-center gap-4"><button onClick={() => navigate('/')} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white border border-gray-700"><ArrowLeft size={20}/></button><div><h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">Distributor</h1><p className="text-xs text-gray-500">Dashboard</p></div></div>
        <div className="flex gap-2"><button onClick={handleShareApp} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white border border-gray-700"><Share2 size={20} /></button><button onClick={() => setViewState('SETTINGS')} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white border border-gray-700"><Settings size={20} /></button></div>
      </div>
      <div className="p-6 overflow-y-auto pb-20">
        {activeSession && (
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-4 border border-primary/50 mb-6 shadow-lg shadow-primary/10 animate-pulse-slow">
                <div className="flex justify-between items-start mb-2"><div className="flex items-center gap-2 text-primary font-bold"><Radio size={18} className="animate-pulse" />LIVE SESSION</div><Button variant="ghost" onClick={() => onStart()} className="p-1 h-8 text-xs border border-primary/30 text-primary hover:bg-primary hover:text-white">Resume <ExternalLink size={12} className="ml-1"/></Button></div>
                <div className="flex gap-4 mt-2"><div className="flex-1 bg-black/30 p-2 text-center"><div className="text-xs text-gray-400 uppercase">Claimed</div><div className="text-xl font-bold text-white">{activeSession.claimed}</div></div>{activeSession.cap > 0 && (<div className="flex-1 bg-black/30 p-2 text-center"><div className="text-xs text-gray-400 uppercase">Cap</div><div className="text-xl font-bold text-gray-300">{activeSession.cap}</div></div>)}</div>
            </div>
        )}
        <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-gray-900 p-4 border border-gray-800 cursor-pointer hover:border-gray-700 transition-colors group" onClick={() => setViewState('UNUSED_LIST')}><div className="text-4xl font-bold text-white mb-1 flex items-center gap-2">{unusedCount}<List size={16} className="text-gray-600 group-hover:text-white transition-colors" /></div><div className="text-xs text-gray-400 uppercase tracking-wider group-hover:text-gray-300">Unused (Manage)</div></div>
            <div className="bg-gray-900 p-4 border border-gray-800 cursor-pointer hover:border-gray-700 transition-colors group" onClick={() => usedCount > 0 && setViewState('USED_LIST')}><div className="text-4xl font-bold text-gray-600 mb-1 flex items-center gap-2 group-hover:text-gray-500">{usedCount}{usedCount > 0 && <Eye size={16} className="text-gray-500 group-hover:text-gray-400" />}</div><div className="text-xs text-gray-500 uppercase tracking-wider group-hover:text-gray-400">Redeemed (View)</div></div>
        </div>
        {!activeSession && unusedCount > 0 && (
            <div className="mb-4">
                <Button fullWidth icon={<Play size={20} />} onClick={onStartSession} className="h-16 text-lg">Start New Session</Button>
            </div>
        )}
        <div className="mb-8">
            <Button variant="ghost" fullWidth icon={<QrCode size={18} />} onClick={() => setShowPermanentQr(true)} className="border border-gray-800 text-gray-400">View Permanent QR Code</Button>
        </div>
        <div className="bg-gray-900 p-4 border border-gray-800 mb-6"><h3 className="font-bold mb-3 flex items-center gap-2"><Plus size={16} className="text-primary"/> Add Codes</h3><textarea value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Paste codes here..." className="w-full bg-gray-950 text-white p-3 min-h-[100px] border border-gray-800 focus:border-primary outline-none mb-3 text-sm font-mono" /><div className="flex gap-2"><Button variant="secondary" onClick={handleAdd} className="flex-1">Add</Button><input type="file" ref={fileInputRef} accept=".txt,.csv" className="hidden" onChange={handleFileUpload} /><Button variant="secondary" onClick={() => fileInputRef.current?.click()}><Upload size={18} /></Button></div></div>
        <div className="grid grid-cols-1 gap-3">
            {unusedCount > 0 && (<Button variant="ghost" className="justify-start border border-gray-800" icon={<Download size={16}/>} onClick={exportUnused}>Export Unused Codes</Button>)}
            {usedCount > 0 && (<Button variant="ghost" className="justify-start border border-gray-800 text-gray-400" icon={<Trash2 size={16}/>} onClick={onClearUsed}>Clear Redeemed Only</Button>)}
            {codes.length > 0 && (<Button variant="danger" className="justify-start" icon={<Trash2 size={16}/>} onClick={onClearAll}>Reset Everything</Button>)}
        </div>
      </div>
    </div>
  );
};