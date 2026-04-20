
import React, { useState, useEffect, Suspense } from 'react';
// @ts-ignore
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { CodeItem, AppSettings } from './types';
import { Loader2 } from 'lucide-react';
import { ConfirmationModal } from './components/ConfirmationModal';
import { ToastProvider } from './components/ToastContext';

const Dashboard = React.lazy(() => import('./components/Dashboard').then(module => ({ default: module.Dashboard })));
const DistributorView = React.lazy(() => import('./components/DistributorView').then(module => ({ default: module.DistributorView })));
const RedeemPage = React.lazy(() => import('./components/RedeemPage').then(module => ({ default: module.RedeemPage })));
const Hub = React.lazy(() => import('./components/Hub').then(module => ({ default: module.Hub })));
const RaffleView = React.lazy(() => import('./components/RaffleView').then(module => ({ default: module.RaffleView })));
const RaffleJoinPage = React.lazy(() => import('./components/RaffleJoinPage').then(module => ({ default: module.RaffleJoinPage })));
const ScavengerHuntView = React.lazy(() => import('./components/ScavengerHuntView').then(module => ({ default: module.ScavengerHuntView })));
const ScavengerHuntLobby = React.lazy(() => import('./components/ScavengerHuntLobby').then(module => ({ default: module.ScavengerHuntLobby })));
const TriviaView = React.lazy(() => import('./components/TriviaView').then(module => ({ default: module.TriviaView })));
const TriviaLobby = React.lazy(() => import('./components/TriviaLobby').then(module => ({ default: module.TriviaLobby })));
const TrainerLanding = React.lazy(() => import('./components/TrainerLanding').then(module => ({ default: module.TrainerLanding })));

const LoadingScreen = () => (
  <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white">
    <Loader2 className="animate-spin text-primary mb-2" size={40} />
    <p className="text-gray-500 text-sm font-mono">Loading module...</p>
  </div>
);

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [showClearUsedModal, setShowClearUsedModal] = useState(false);
  const [showClearAllModal, setShowClearAllModal] = useState(false);

  const [codes, setCodes] = useState<CodeItem[]>(() => {
    const saved = localStorage.getItem('pogo_codes');
    return saved ? JSON.parse(saved) : [];
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('pogo_settings');
    const defaults = {
      baseUrl: 'https://store.pokemongo.com/offer-redemption', 
      vibration: true,
      testMode: false,
      distributionCap: 0,
      blockIncognito: false,
      removeDailyLimit: false,
      ambassador: {
        communityName: '',
        campfireUrl: '',
        groupLogo: null,
        notes: '',
        limitWarning: 'PoGO restricts accounts to 1 code per week. If the Web Store says "...code is invalid, or you do not qualify...", this code is valid, but your account is on cooldown.',
        description: '',
        socialUrl: ''
      }
    };
    
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaults, ...parsed, ambassador: { ...defaults.ambassador, ...parsed.ambassador } };
    }
    return defaults;
  });

  useEffect(() => {
    localStorage.setItem('pogo_codes', JSON.stringify(codes));
  }, [codes]);

  useEffect(() => {
    localStorage.setItem('pogo_settings', JSON.stringify(settings));
  }, [settings]);

  const handleAddCodes = (rawText: string, preMarkedUsedData: Record<string, any> = {}) => {
    const rawList = rawText.split(/[\n,\s]+/).map(s => s.replace(/['"]/g, '').trim()).filter(s => s);
    const uniqueRawList = Array.from(new Set(rawList));
    
    setCodes(prev => {
      const finalCodes: CodeItem[] = [];
      const processedValues = new Set<string>();
      let changed = false;
      
      // 1. Process existing codes (update if they are newly marked as used)
      for (const existing of prev) {
        const dbData = preMarkedUsedData[existing.value];
        if (dbData && !existing.isUsed) {
          // It was unused locally, but used in DB. Update it!
          finalCodes.push({
            ...existing,
            isUsed: true,
            claimedAt: dbData.claimedAt?.seconds ? dbData.claimedAt.seconds * 1000 : (dbData.claimedAt || Date.now()),
            claimedByIgn: dbData.claimedByIgn || existing.claimedByIgn,
            source: dbData.source || existing.source
          });
          changed = true;
        } else {
          finalCodes.push(existing);
        }
        processedValues.add(existing.value);
      }
      
      // 2. Add new codes
      for (const val of uniqueRawList) {
        if (!processedValues.has(val)) {
          const dbData = preMarkedUsedData[val];
          finalCodes.push({
            id: uuidv4(),
            value: val,
            isUsed: !!dbData,
            dateAdded: Date.now(),
            claimedAt: dbData ? (dbData.claimedAt?.seconds ? dbData.claimedAt.seconds * 1000 : (dbData.claimedAt || Date.now())) : undefined,
            claimedByIgn: dbData?.claimedByIgn,
            source: dbData?.source
          });
          changed = true;
          processedValues.add(val);
        }
      }
      
      return changed ? finalCodes : prev;
    });
  };

  const handleReserveCodes = (ids: string[]) => {
      const idSet = new Set(ids);
      setCodes(prev => prev.map(c => {
          if (idSet.has(c.id)) {
              return { ...c, isReserved: true };
          }
          return c;
      }));
  };

  const handleSyncSession = (usedData: {id: string, claimedAt: number, claimedByIgn?: string, source?: 'raffle_win' | 'direct_scan', isBadCode?: boolean}[]) => {
    const usedMap = new Map(usedData.map(item => [item.id, item]));
    setCodes(prev => prev.map(c => {
        const match = usedMap.get(c.id);
        if (match) {
            return { 
                ...c, 
                isUsed: true, 
                isReserved: false, // Clear reservation on claim
                claimedAt: match.claimedAt,
                claimedByIgn: match.claimedByIgn,
                source: match.source || 'direct_scan',
                isBadCode: match.isBadCode
            };
        }
        return c;
    }));
  };

  const handleRefundCodes = (ids: string[]) => {
      const idSet = new Set(ids);
      setCodes(prev => prev.map(c => {
          if (idSet.has(c.id)) {
              return { ...c, isUsed: false, isReserved: false, claimedAt: undefined, claimedByIgn: undefined, source: undefined };
          }
          return c;
      }));
  };

  const handleClearUsed = () => {
    setShowClearUsedModal(true);
  };

  const confirmClearUsed = () => {
    setCodes(prev => prev.filter(c => !c.isUsed));
  };

  const handleClearAll = () => {
    setShowClearAllModal(true);
  };

  const confirmClearAll = () => {
    setCodes([]);
  };

  const handleDeleteCode = (id: string) => {
    setCodes(prev => prev.filter(c => c.id !== id));
  };

  const handleEditCode = (id: string, newVal: string) => {
    setCodes(prev => prev.map(c => c.id === id ? { ...c, value: newVal } : c));
  };

  const handleToggleBadCode = (id: string) => {
    setCodes(prev => prev.map(c => c.id === id ? { ...c, isBadCode: !c.isBadCode } : c));
  };

  const handleMarkBadCodes = (values: string[]) => {
    const valueSet = new Set(values);
    setCodes(prev => prev.map(c => valueSet.has(c.value) ? { ...c, isBadCode: true } : c));
  };

  const handleRecoverCodes = (recoveredCodes: { code: string, ign: string, date: string, source: string }[]) => {
    const existingValues = new Set(codes.map(c => c.value));
    const newItems: CodeItem[] = recoveredCodes
      .filter(rc => !existingValues.has(rc.code))
      .map(rc => ({
        id: uuidv4(),
        value: rc.code,
        isUsed: true,
        dateAdded: Date.now(),
        claimedAt: new Date(rc.date).getTime() || Date.now(),
        claimedByIgn: rc.ign,
        source: (rc.source as any) || 'direct_scan'
      }));

    if (newItems.length > 0) {
      setCodes(prev => [...prev, ...newItems]);
    }
    return { imported: newItems.length, duplicates: recoveredCodes.length - newItems.length };
  };

  useEffect(() => {
    const path = location.pathname;
    let title = 'CA Meetup +';
    
    if (path === '/') {
      title = 'Dashboard | CA Meetup +';
    } else if (path.startsWith('/distributor')) {
      title = 'Code Distributor | CA Meetup +';
    } else if (path.startsWith('/raffle')) {
      title = 'Raffle Master | CA Meetup +';
    } else if (path.startsWith('/trivia')) {
      title = 'Trivia Master | CA Meetup +';
    } else if (path.startsWith('/scavenger') || path.startsWith('/play')) {
      title = 'Scavenger Hunt | CA Meetup +';
    }
    
    document.title = title;
  }, [location.pathname]);

  return (
    <ToastProvider>
      <div className={`h-[100dvh] w-full bg-gray-950 text-white overflow-hidden mx-auto shadow-2xl relative max-w-lg`}>
        <ConfirmationModal 
          isOpen={showClearUsedModal}
        onClose={() => setShowClearUsedModal(false)}
        onConfirm={confirmClearUsed}
        title="Clear Redeemed Codes"
        message="Are you sure you want to remove all redeemed codes from the list?"
        confirmText="Yes, Remove"
      />
      <ConfirmationModal 
        isOpen={showClearAllModal}
        onClose={() => setShowClearAllModal(false)}
        onConfirm={confirmClearAll}
        title="Delete ALL Codes"
        message="This will delete ALL codes. Cannot be undone."
        confirmText="Delete Everything"
        isDanger={true}
      />

      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<Hub settings={settings} onUpdateSettings={setSettings} onRecoverCodes={handleRecoverCodes} />} />
          
          <Route path="/distributor" element={
              <Dashboard 
                codes={codes}
                onAddCodes={handleAddCodes}
                onClearUsed={handleClearUsed}
                onClearAll={handleClearAll}
                onDeleteCode={handleDeleteCode}
                onEditCode={handleEditCode}
                onToggleBadCode={handleToggleBadCode}
                onMarkBadCodes={handleMarkBadCodes}
                onStart={() => navigate('/distributor/session')}
                settings={settings}
                onUpdateSettings={setSettings}
              />
          } />
          
          <Route path="/distributor/session" element={
              <DistributorView 
                codes={codes}
                onSessionComplete={handleSyncSession}
                onExit={() => navigate('/distributor')}
                settings={settings}
              />
          } />

          <Route path="/raffle" element={
              <RaffleView 
                settings={settings} 
                codes={codes} 
                onSyncCodes={handleSyncSession}
                onRefundCodes={handleRefundCodes}
                onReserveCodes={handleReserveCodes}
              />
          } />
          <Route path="/raffle/join/:sessionId" element={<RaffleJoinPage />} />
          
          <Route path="/scavenger" element={<ScavengerHuntView settings={settings} />} />
          <Route path="/play/:huntId" element={<ScavengerHuntLobby />} />

          <Route path="/trivia" element={<TriviaView settings={settings} />} />
          <Route path="/trivia/play/:sessionId" element={<TriviaLobby />} />
          
          <Route path="/community" element={<TrainerLanding />} />

          <Route path="/claim/:codeId/:codeValue" element={<RedeemPage />} />
          <Route path="/session/:sessionId" element={<RedeemPage />} />
        </Routes>
      </Suspense>
      </div>
    </ToastProvider>
  );
};

export default App;