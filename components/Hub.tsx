import React, { useState, useRef, useEffect } from "react";
// @ts-ignore
import { useNavigate } from "react-router-dom";
import { AppSettings, UserRole } from "../types";
import {
  QrCode,
  Ticket,
  Map,
  Settings,
  Users,
  ArrowRight,
  ArrowLeft,
  Image as ImageIcon,
  Flame,
  AlertTriangle,
  Sparkles,
  Check,
  Info,
  Lock,
  LogOut,
  X,
  ShieldCheck,
  BrainCircuit,
  MessageSquareQuote,
  Shield,
  Trash2,
  ShieldAlert,
  Cloud,
  CloudOff,
  Menu,
  UserCircle,
  Globe,
  Upload,
  Download,
  Loader2,
  Clock,
  Palette,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./Button";
// @ts-ignore
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
// @ts-ignore
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { PrivacyModal } from "./PrivacyModal";
import { ConfirmationModal } from "./ConfirmationModal";
import { GlobalSettingsModal } from "./GlobalSettingsModal";
import { AmbassadorDirectoryModal } from "./AmbassadorDirectoryModal";
import { useToast } from "./ToastContext";
import { useDiscordAuth } from "./useDiscordAuth";

// Fix for framer-motion type mismatch
const MotionDiv = motion.div as any;

interface HubProps {
  codes?: any[];
  onUpdateCodes?: (c: any[]) => void;
  settings: AppSettings;
  onUpdateSettings: (s: AppSettings) => void;
}

export const Hub: React.FC<HubProps> = ({
  codes = [],
  onUpdateCodes,
  settings,
  onUpdateSettings,
}) => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [isSettingsMode, setIsSettingsMode] = useState(false);
  const [showSetupComplete, setShowSetupComplete] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isGlobalSettingsOpen, setIsGlobalSettingsOpen] = useState(false);
  const [isDirectoryOpen, setIsDirectoryOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Discord Auth
  const {
    user: discordUser,
    isLoading: isDiscordLoading,
    login: discordLogin,
    logout: discordLogout,
  } = useDiscordAuth();

  // AUTH STATE
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<UserRole>("user");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [secretTaps, setSecretTaps] = useState(0);
  const [discordRole, setDiscordRole] = useState<'guest' | 'host'>('guest');
  const [showDiscordPrompt, setShowDiscordPrompt] = useState(false);

  // TOAST STATE
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showShredConfirm, setShowShredConfirm] = useState(false);
  const [hasCloudBackup, setHasCloudBackup] = useState<boolean | null>(null);

  useEffect(() => {
    const checkBackupStatus = async () => {
      if (!discordUser) {
        setHasCloudBackup(false);
        return;
      }
      try {
        const docRef = doc(db, "discord_sync", discordUser.id);
        const snap = await getDoc(docRef);
        setHasCloudBackup(snap.exists());
      } catch (e) {
        console.error("Error checking cloud backup", e);
        setHasCloudBackup(false);
      }
    };
    checkBackupStatus();
  }, [discordUser]);

  const handleBackupToCloud = async () => {
    if (!discordUser) return;
    setIsSyncing(true);
    try {
      await setDoc(doc(db, "discord_sync", discordUser.id), {
        settings,
        codes: codes,
        updatedAt: serverTimestamp(),
      });
      setHasCloudBackup(true);
      addToast("Successfully backed up to cloud!", "success");
    } catch (e: any) {
      console.error("Failed to backup:", e);
      addToast("Failed to backup: " + e.message, "error");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestoreFromCloud = async () => {
    if (!discordUser) return;
    setShowRestoreConfirm(false);
    setIsSyncing(true);
    try {
      const docRef = doc(db, "discord_sync", discordUser.id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.settings) onUpdateSettings(data.settings);
        if (data.codes && typeof onUpdateCodes === "function") {
          onUpdateCodes(data.codes);
        }
        
        // Burn: delete the backup after a successful restore
        try {
          await deleteDoc(docRef);
          setHasCloudBackup(false);
          addToast("Successfully restored and wiped from cloud!", "success");
        } catch (burnError: any) {
          console.error("Failed to wipe cloud backup:", burnError);
          addToast("Restored locally, but cloud wipe failed. Please use the Shredder button to clear it manually.", "warning");
        }
      } else {
        setHasCloudBackup(false);
        addToast("No cloud backup found.", "warning");
      }
    } catch (e: any) {
      console.error("Failed to restore:", e);
      addToast("Failed to restore: " + e.message, "error");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteFromCloud = async () => {
    if (!discordUser) return;
    setShowShredConfirm(false);
    setIsSyncing(true);
    try {
      await deleteDoc(doc(db, "discord_sync", discordUser.id));
      setHasCloudBackup(false);
      addToast("Cloud backup permanently wiped.", "success");
    } catch (e: any) {
      console.error("Failed to delete backup:", e);
      addToast("Failed to wipe cloud backup: " + e.message, "error");
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    let docUnsub: () => void = () => {};

    const authUnsub = onAuthStateChanged(auth, async (user: any) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          docUnsub = onSnapshot(userDocRef, async (userSnap) => {
            if (userSnap.exists()) {
              const data = userSnap.data() as any;
              let r = (data.role || "admin").toLowerCase();
              if (user.email === 'elmersdesign@gmail.com') r = 'super_admin';
              setUserRole(r as UserRole);

              // --- CLOUD SYNC: PULL ---
              if (data.profile) {
                onUpdateSettings({
                  ...settings,
                  ambassador: data.profile,
                });
              }
            } else {
              // Create early doc layout if missing
              await setDoc(
                userDocRef,
                {
                  uid: user.uid,
                  email: user.email,
                  role: "admin",
                  lastLogin: serverTimestamp(),
                },
                { merge: true },
              );
              setUserRole("admin");
            }
          });
        } catch (e) {
          console.error("Error setting up user snapshot", e);
          setUserRole("admin");
        }
      } else {
        docUnsub();
        setUserRole("user");
      }
    });
    return () => {
      authUnsub();
      docUnsub();
    };
  }, []);

  useEffect(() => {
    if (userRole === "super_admin") {
      const q = query(
        collection(db, "recovery_requests"),
        where("status", "==", "pending"),
      );
      const unsub = onSnapshot(q, (snap) => {
        setPendingRequestsCount(snap.size);
      });
      return () => unsub();
    } else {
      setPendingRequestsCount(0);
    }
  }, [userRole]);

  // Sync Discord profile to Firebase User Document
  useEffect(() => {
    if (currentUser && discordUser) {
      const syncDiscord = async () => {
        try {
          await setDoc(
            doc(db, "users", currentUser.uid),
            {
              discordId: discordUser.id,
              discordUsername: discordUser.username,
              discordAvatar: discordUser.avatar,
              discordInServer: discordUser.inServer,
              lastDiscordSync: serverTimestamp(),
            },
            { merge: true },
          );
        } catch (err) {
          console.error("Failed to sync discord to firestore", err);
        }
      };
      syncDiscord();
    }
  }, [currentUser, discordUser]);

  // REAL-TIME HOST VERIFICATION: Listen for role upgrades from the Super Admin
  useEffect(() => {
    if (discordUser) {
      const unsub = onSnapshot(doc(db, "ambassador_directory", discordUser.id), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setDiscordRole(data.role === 'host' ? 'host' : 'guest');
        }
      });
      return () => unsub();
    } else {
      setDiscordRole('guest');
    }
  }, [discordUser]);

  // AUTOMATIC GUEST REGISTRATION: Save EVERY Discord user to a master directory
  useEffect(() => {
    if (discordUser) {
      const registerGuest = async () => {
        try {
          await setDoc(
            doc(db, "ambassador_directory", discordUser.id),
            {
              discordId: discordUser.id,
              discordUsername: discordUser.username,
              discordAvatar: discordUser.avatar,
              discordInServer: discordUser.inServer,
              lastSeen: serverTimestamp(),
              communityName: settings.ambassador.communityName || "Unknown"
            },
            { merge: true }
          );
        } catch (err) {
          console.error("Failed to register user to directory", err);
        }
      };
      registerGuest();
    }
  }, [discordUser, settings.ambassador.communityName]);

  // DISCORD PROMPT: Show modal on initial load if not linked
  useEffect(() => {
    if (!isDiscordLoading && !discordUser) {
      setShowDiscordPrompt(true);
    }
  }, [isDiscordLoading, discordUser]);

  const communityName = settings.ambassador.communityName || "My Community";
  const needsSetup = !settings.ambassador.communityName;

  const isSuperAdmin = userRole === "super_admin";
  const isAdmin = userRole === "admin" || isSuperAdmin;

  // Listen for pending ambassadors (for Super Admins)
  useEffect(() => {
    if (!isSuperAdmin) {
      setPendingApprovalCount(0);
      return;
    }

    const unsub = onSnapshot(collection(db, "ambassador_directory"), (snapshot) => {
      let count = 0;
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data.role || data.role === 'user' || data.role === 'guest') {
          count++;
        }
      });
      setPendingApprovalCount(count);
    }, (err) => {
      console.error(err);
    });
    
    return () => unsub();
  }, [isSuperAdmin]);

  const tools = [
    {
      id: "distributor",
      title: "Code Distributor",
      desc: "Quick QR queue system for promo codes.",
      icon: <QrCode size={32} className="text-primary" />,
      path: "/distributor",
      color: "border-primary/50 hover:border-primary",
      shadowColor: "shadow-primary/20",
      active: true,
      locked: false,
    },
    {
      id: "raffle",
      title: "Raffle Master",
      desc: "Host live giveaways for attendees in real-time.",
      icon: <Ticket size={32} className="text-purple-400" />,
      path: "/raffle",
      color: "border-purple-500/50 hover:border-purple-500",
      shadowColor: "shadow-purple-500/20",
      active: true,
      locked: false,
    },
    {
      id: "trivia",
      title: "Trivia Master",
      desc: "Custom mobile trivia for your community.",
      icon: <BrainCircuit size={32} className="text-blue-400" />,
      path: "/trivia",
      color: "border-blue-500/50 hover:border-blue-500 cursor-pointer",
      shadowColor: "shadow-blue-500/20",
      active: true,
      locked: false,
      badge: "BETA",
    },
    {
      id: "scavenger",
      title: "Scavenger Hunt",
      desc: "Create GPS-based checkpoints.",
      icon: (
        <Map
          size={32}
          className={(isSuperAdmin || discordRole === 'host') ? "text-green-400" : "text-gray-600"}
        />
      ),
      path: "/scavenger",
      color: (isSuperAdmin || discordRole === 'host')
        ? "border-green-500/50 hover:border-green-500 cursor-pointer"
        : "border-gray-800 opacity-50 cursor-not-allowed",
      shadowColor: (isSuperAdmin || discordRole === 'host') ? "shadow-green-500/20" : "shadow-none",
      active: isSuperAdmin || discordRole === 'host',
      locked: !(isSuperAdmin || discordRole === 'host'),
      badge: "ALPHA",
    },
  ];

  if (isSuperAdmin) {
    tools.push({
      id: "playground",
      title: "Button Playground",
      desc: "Admin view to preview button styles.",
      icon: <Palette size={32} className="text-pink-400" />,
      path: "/button-playground",
      color: "border-pink-500/50 hover:border-pink-500 cursor-pointer",
      shadowColor: "shadow-pink-500/20",
      active: true,
      locked: false,
      badge: "ADMIN",
    });
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        addToast(
          "File size too large! Please upload a logo smaller than 500KB.",
          "error",
        );
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        onUpdateSettings({
          ...settings,
          ambassador: { ...settings.ambassador, groupLogo: base64 },
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveSettings = async () => {
    setIsSettingsMode(false);

    // --- CLOUD SYNC: PUSH ---
    if (currentUser) {
      try {
        await updateDoc(doc(db, "users", currentUser.uid), {
          profile: settings.ambassador,
        });
      } catch (e) {
        console.error("Failed to sync to cloud", e);
        addToast(
          "Settings saved locally, but failed to sync to cloud.",
          "warning",
        );
      }
    }

    if (settings.ambassador.communityName) {
      setShowSetupComplete(true);
      setTimeout(() => setShowSetupComplete(false), 8000);
    }
  };

  const handleSecretTap = () => {
    const newCount = secretTaps + 1;
    setSecretTaps(newCount);
    if (newCount >= 7) {
      setShowAuthModal(true);
      setSecretTaps(0);
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
    }
  };

  const handleAdminLogin = async () => {
    setAuthLoading(true);
    try {
      await signInWithEmailAndPassword(auth, emailInput, passwordInput);
      setShowAuthModal(false);
      setEmailInput("");
      setPasswordInput("");
      // Replaced alert with Toast
      addToast("Admin Mode Unlocked", "success");
    } catch (e: any) {
      addToast("Login failed: " + e.message, "error");
    } finally {
      setAuthLoading(false);
    }
  };

  const renderAuthModal = () =>
    showAuthModal && (
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-700 p-6 w-full max-w-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
              Admin Login
            </h3>
            <button onClick={() => setShowAuthModal(false)}>
              <X className="text-gray-500" />
            </button>
          </div>
          {currentUser ? (
            <div className="space-y-4">
              <div
                className={`p-3  text-sm text-center border ${isSuperAdmin ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30"}`}
              >
                <div className="font-bold flex items-center justify-center gap-2">
                  {isSuperAdmin ? (
                    <ShieldCheck size={16} />
                  ) : (
                    <Users size={16} />
                  )}
                  {isSuperAdmin ? "Super Admin" : "Admin"}
                </div>
                <div className="text-xs opacity-70 mt-1">
                  {currentUser.email}
                </div>
              </div>
              <Button
                fullWidth
                onClick={() => signOut(auth)}
                variant="secondary"
              >
                Sign Out
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="email"
                placeholder="Admin Email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 p-3 text-sm focus:border-primary outline-none"
              />
              <input
                type="password"
                placeholder="Password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 p-3 text-sm focus:border-primary outline-none"
              />
              <Button
                fullWidth
                onClick={handleAdminLogin}
                disabled={authLoading}
              >
                {authLoading ? "Verifying..." : "Unlock Features"}
              </Button>
            </div>
          )}
        </div>
      </div>
    );

  if (isSettingsMode) {
    return (
      <div className="flex flex-col h-full bg-gray-950 text-white">
        <ConfirmationModal 
            isOpen={showRestoreConfirm} 
            onClose={() => setShowRestoreConfirm(false)} 
            onConfirm={handleRestoreFromCloud} 
            title="Restore & Burn?" 
            message="This will overwrite your current device data with your cloud backup. Once restored, the cloud backup WILL BE DELETED to preserve security. Are you sure you want to proceed?" 
            confirmText="Yes, Restore & Burn" 
            isDanger={true} 
        />
        <ConfirmationModal 
            isOpen={showShredConfirm} 
            onClose={() => setShowShredConfirm(false)} 
            onConfirm={handleDeleteFromCloud} 
            title="Shred Cloud Backup?" 
            message="This will permanently delete your stored settings and codes from the cloud. Your local data will remain. Are you sure you want to proceed?" 
            confirmText="Yes, Shred Backup" 
            isDanger={true} 
        />
        <div className="p-4 border-b border-gray-800 flex items-center gap-4 bg-gray-900 sticky top-0 z-30">
          <button
            onClick={() => setIsSettingsMode(false)}
            className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white border border-gray-700"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-bold">Community Profile</h2>
            <p className="text-xs text-gray-500">
              Global settings for all tools
            </p>
          </div>
        </div>

        {currentUser && (
          <div className="bg-green-900/20 border-b border-green-900/30 px-6 py-2 flex items-center gap-2">
            <Cloud size={14} className="text-green-400" />
            <span className="text-xs text-green-400 font-bold">
              Cloud Sync Active
            </span>
          </div>
        )}
        {!currentUser && (
          <div className="bg-gray-900 border-b border-gray-800 px-6 py-2 flex items-center gap-2">
            <CloudOff size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500">Local Storage Only</span>
          </div>
        )}

        <div className="p-6 overflow-y-auto pb-24 space-y-6">
          <div>
            <label className="block text-sm text-gray-400 mb-1 flex items-center gap-2">
              <Users size={16} /> Community Name
            </label>
            <input
              type="text"
              placeholder="e.g. Fullerton GO"
              value={settings.ambassador.communityName || ""}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  ambassador: {
                    ...settings.ambassador,
                    communityName: e.target.value,
                  },
                })
              }
              className="w-full bg-gray-900 border border-gray-800 p-3 focus:border-primary outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
              <ImageIcon size={16} /> Group Logo
            </label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-gray-900 border border-gray-800 flex items-center justify-center overflow-hidden">
                {settings.ambassador.groupLogo ? (
                  <img
                    src={settings.ambassador.groupLogo}
                    alt="Group Logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="text-gray-700" size={32} />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  type="file"
                  ref={logoInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <Button
                  variant="secondary"
                  onClick={() => logoInputRef.current?.click()}
                  className="text-xs py-2 h-10"
                >
                  Upload Logo
                </Button>
              </div>
            </div>
          </div>

          {/* Community Details Section */}
          <div className="space-y-4 pt-4 border-t border-gray-800">
            <h3 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
              <Info size={14} /> Community Details
            </h3>

            <div>
              <label className="block text-sm text-gray-400 mb-1 flex items-center gap-2">
                Description
              </label>
              <textarea
                maxLength={300}
                rows={4}
                placeholder="Tell your members about your group! (Max 300 chars)"
                value={settings.ambassador.description || ""}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    ambassador: {
                      ...settings.ambassador,
                      description: e.target.value,
                    },
                  })
                }
                className="w-full bg-gray-900 border border-gray-800 p-3 focus:border-primary outline-none resize-none text-sm"
              />
              <p className="text-xs text-gray-500 text-right">
                {settings.ambassador.description?.length || 0}/300
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1 flex items-center gap-2">
                <Flame size={16} className="text-orange-500" /> Campfire URL
              </label>
              <input
                type="url"
                placeholder="https://campfire.onelink.me/..."
                value={settings.ambassador.campfireUrl}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    ambassador: {
                      ...settings.ambassador,
                      campfireUrl: e.target.value,
                    },
                  })
                }
                className="w-full bg-gray-900 border border-gray-800 p-3 focus:border-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1 flex items-center gap-2">
                <Globe size={16} className="text-blue-400" /> Website / Other
                Link
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={settings.ambassador.socialUrl || ""}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    ambassador: {
                      ...settings.ambassador,
                      socialUrl: e.target.value,
                    },
                  })
                }
                className="w-full bg-gray-900 border border-gray-800 p-3 focus:border-primary outline-none"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-gray-800 space-y-4">
            <div className="bg-gray-900 border border-gray-800 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users size={18} className="text-[#5865F2]" />
                <span className="font-bold text-white text-sm">
                  Discord Identity
                </span>
              </div>
              <p className="text-xs text-gray-400 mb-4">
                We are transitioning the CA Meetup+ platform to become exclusive
                to verified Ambassadors. Link your Discord account to prepare
                for this transition.
              </p>
              {isDiscordLoading ? (
                <div className="text-xs text-gray-500 animate-pulse">
                  Checking Discord status...
                </div>
              ) : discordUser ? (
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {discordUser.avatar ? (
                        <img
                          src={`https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`}
                          alt="Avatar"
                          className="w-10 h-10 rounded-full border-2 border-gray-700"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center text-xs">
                          No Pic
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-bold text-white">
                          {discordUser.username}
                        </div>
                        <div className="text-xs text-green-400 flex items-center gap-1">
                          <Check size={12} /> Connected
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={discordLogout}
                      className="text-xs border border-gray-700 text-gray-400 hover:text-white"
                    >
                      Unlink
                    </Button>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      fullWidth
                      variant="secondary"
                      onClick={handleBackupToCloud}
                      disabled={isSyncing}
                      className="bg-gray-800 text-xs py-2 h-auto text-gray-300"
                    >
                      {isSyncing ? (
                        <Loader2 size={14} className="mr-1 animate-spin" />
                      ) : (
                        <Upload size={14} className="mr-1" />
                      )}{" "}
                      Backup
                    </Button>
                    <Button
                      fullWidth
                      variant="secondary"
                      onClick={() => setShowRestoreConfirm(true)}
                      disabled={isSyncing || hasCloudBackup === false}
                      className={`text-xs py-2 h-auto ${hasCloudBackup === false ? 'bg-gray-900 text-gray-600 border-gray-800' : 'bg-gray-800 text-gray-300'} transition-opacity ${hasCloudBackup === false ? 'opacity-50' : ''}`}
                    >
                      {isSyncing ? (
                        <Loader2 size={14} className="mr-1 animate-spin" />
                      ) : hasCloudBackup === false ? (
                        <CloudOff size={14} className="mr-1" />
                      ) : (
                        <Download size={14} className="mr-1" />
                      )}{" "}
                      {hasCloudBackup === false ? "No Backup" : "Restore"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setShowShredConfirm(true)}
                      disabled={isSyncing || hasCloudBackup === false}
                      className={`text-xs border ${hasCloudBackup === false ? 'bg-gray-950 text-gray-700 border-gray-900 pointer-events-none' : 'bg-gray-900/50 text-red-500 border-red-900/50 hover:bg-red-900/30 hover:text-red-400'}`}
                      title="Permanently Delete Cloud Backup"
                    >
                        <Trash2 size={14} />
                    </Button>
                  </div>
                  <div className="mt-3 text-xs flex items-start gap-2 bg-gray-950 p-2 border border-gray-800">
                    {discordUser.inServer ? (
                      <>
                        <ShieldCheck
                          size={14}
                          className="text-green-500 mt-0.5 shrink-0"
                        />{" "}
                        <span className="text-green-300">
                          Community Server Verification Passed
                        </span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert
                          size={14}
                          className="text-red-500 mt-0.5 shrink-0"
                        />{" "}
                        <span className="text-red-300">
                          You are not in the required Ambassador Community
                          Discord Server.
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <Button
                  fullWidth
                  onClick={discordLogin}
                  className="bg-[#5865F2] hover:bg-[#4752C4] text-white"
                >
                  Link Discord Account
                </Button>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-gray-800 space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1 flex items-center gap-2">
                <MessageSquareQuote size={16} /> Short Welcome Message
              </label>
              <textarea
                maxLength={150}
                rows={2}
                placeholder="e.g. Thanks for joining us for Community Day!"
                value={settings.ambassador.notes}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    ambassador: {
                      ...settings.ambassador,
                      notes: e.target.value,
                    },
                  })
                }
                className="w-full bg-gray-900 border border-gray-800 p-3 focus:border-primary outline-none resize-none text-sm"
              />
              <p className="text-xs text-gray-500">
                Displayed briefly during rewards.
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-800 space-y-4">
            <Button fullWidth onClick={handleSaveSettings}>
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white relative">
      {renderAuthModal()}
      <PrivacyModal
        isOpen={isPrivacyOpen}
        onClose={() => setIsPrivacyOpen(false)}
      />
      <GlobalSettingsModal
        isOpen={isGlobalSettingsOpen}
        onClose={() => setIsGlobalSettingsOpen(false)}
      />
      <AmbassadorDirectoryModal
        isOpen={isDirectoryOpen}
        onClose={() => setIsDirectoryOpen(false)}
      />

      {/* Top Navigation */}
      <div className="p-4 flex items-center justify-between border-b border-gray-900 bg-gray-950 relative z-30">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0 w-12 h-12 flex items-center justify-center">
            <img
              src="https://app.fullertonpogo.com/img/meetupplus.png"
              alt="CA Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <h1
              onClick={handleSecretTap}
              className="text-3xl font-black animate-gradient-text tracking-tight select-none active:translate-y-1 active:translate-x-1 transition-transform cursor-pointer"
            >
              CA Meetup +
            </h1>
            <p className="text-gray-400 text-sm font-bold flex items-center gap-2">
              <Users size={14} className="text-primary shrink-0" />
              <span className="truncate max-w-[150px]">{communityName}</span>
              {isAdmin && !isSuperAdmin && (
                <span className="text-[10px] px-1.5 py-0.5 ml-1 bg-blue-900 text-blue-400 shrink-0">
                  ADMIN
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Menu Button */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`p-3 rounded-full border transition-colors relative ${isSuperAdmin ? "bg-green-600 border-green-500 text-white hover:bg-green-500" : isMenuOpen ? "bg-gray-800 border-gray-700 text-white" : "bg-gray-900 border-gray-800 text-gray-400 hover:text-white"}`}
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          {(pendingRequestsCount > 0 || pendingApprovalCount > 0) && !isMenuOpen && (
            <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-gray-950"></span>
          )}
        </button>
      </div>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <MotionDiv
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-20"
              onClick={() => setIsMenuOpen(false)}
            />
            <MotionDiv
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute top-28 right-4 w-64 bg-gray-900 border border-gray-800 shadow-2xl z-40 p-2 flex flex-col gap-1 overflow-hidden"
            >
              {currentUser && (
                <div className="px-4 py-3 border-b border-gray-800 mb-1">
                  <div className="text-xs text-gray-500 uppercase font-bold">
                    Signed in as
                  </div>
                  <div className="text-sm text-white font-bold truncate">
                    {currentUser.email}
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setShowAuthModal(true);
                }}
                className="flex items-center gap-3 w-full p-3 hover:bg-gray-800 text-left transition-colors text-sm font-bold text-gray-300 hover:text-white"
              >
                <ShieldCheck size={18} className="text-primary" />
                {currentUser ? "Admin Account" : "Admin Login"}
              </button>

              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsSettingsMode(true);
                }}
                className="flex items-center gap-3 w-full p-3 hover:bg-gray-800 text-left transition-colors text-sm font-bold text-gray-300 hover:text-white"
              >
                <Settings size={18} className="text-gray-400" />
                Community Settings
              </button>

              {isSuperAdmin && (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsDirectoryOpen(true);
                  }}
                  className="flex items-center justify-between w-full p-3 hover:bg-gray-800 text-left transition-colors text-sm font-bold text-gray-300 hover:text-white"
                >
                  <div className="flex items-center gap-3">
                    <Users size={18} className="text-yellow-400" />
                    Ambassador Directory
                  </div>
                  {pendingApprovalCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                      {pendingApprovalCount}
                    </span>
                  )}
                </button>
              )}

              {isSuperAdmin && (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsGlobalSettingsOpen(true);
                  }}
                  className="flex items-center gap-3 w-full p-3 hover:bg-gray-800 text-left transition-colors text-sm font-bold text-gray-300 hover:text-white"
                >
                  <Globe size={18} className="text-purple-400" />
                  Global App Settings
                </button>
              )}

              {isSuperAdmin && pendingRequestsCount > 0 && (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    navigate("/distributor", {
                      state: { tab: "RECOVERY_REQUESTS" },
                    });
                  }}
                  className="flex items-center justify-between w-full p-3 bg-red-900/20 hover:bg-red-900/30 text-left transition-colors text-sm font-bold text-red-400"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle size={18} />
                    Pending Requests
                  </div>
                  <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                    {pendingRequestsCount}
                  </span>
                </button>
              )}

              {currentUser && (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    signOut(auth);
                  }}
                  className="flex items-center gap-3 w-full p-3 hover:bg-red-900/20 text-left transition-colors text-sm font-bold text-red-400"
                >
                  <LogOut size={18} />
                  Sign Out
                </button>
              )}
            </MotionDiv>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 p-6 overflow-y-auto">
        <AnimatePresence>
          {needsSetup && (
            <MotionDiv
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 cursor-pointer"
              onClick={() => setIsSettingsMode(true)}
            >
              <div className="p-4 bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-500/30 flex items-center justify-between shadow-lg backdrop-blur-sm group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-blue-200">
                      Welcome, Ambassador!
                    </h3>
                    <p className="text-xs text-blue-300/70">
                      Tap to set your Community Name
                    </p>
                  </div>
                </div>
                <ArrowRight size={18} className="text-blue-400/50" />
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 gap-4 pb-8">
          {tools.map((tool) => (
            <MotionDiv
              key={tool.id}
              whileTap={(tool.active ? { scale: 0.98 } : {}) as any}
              onClick={() => tool.active && navigate(tool.path)}
              className={`bg-gray-900 p-6  border ${tool.color} transition-all relative overflow-hidden group shadow-lg ${tool.shadowColor} ${!tool.active ? "pointer-events-none" : "cursor-pointer"}`}
            >
              {(tool as any).locked && (
                <div className="absolute top-4 right-4 text-gray-700">
                  <Lock size={20} />
                </div>
              )}
              <div className="flex items-start justify-between relative z-10">
                <div className="flex gap-4">
                  <div className="bg-gray-950 p-3 border border-gray-800">
                    {tool.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors flex items-center gap-2">
                      {tool.title}
                      {(tool as any).badge && (
                        <span
                          className={`text-[9px] px-1.5 py-[1px]  font-black uppercase tracking-wider leading-none self-center ${(tool as any).badge === "BETA" ? "bg-blue-500 text-black" : "bg-green-500 text-black"}`}
                        >
                          {(tool as any).badge}
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-400 leading-tight">
                      {tool.desc}
                    </p>
                  </div>
                </div>
                {tool.active && (
                  <ArrowRight className="text-gray-600 group-hover:text-white transition-colors" />
                )}
              </div>
              <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl pointer-events-none" />
            </MotionDiv>
          ))}
        </div>

        <div className="mt-4 text-center pb-8">
          <button
            onClick={() => setIsPrivacyOpen(true)}
            className="text-[10px] text-gray-600 font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 mx-auto hover:text-gray-400 transition-colors"
          >
            <Shield size={12} /> Privacy Policy & Data Usage
          </button>
        </div>
      </div>

      {/* Mandatory Discord Prompt Modal */}
      <AnimatePresence>
        {showDiscordPrompt && !isDiscordLoading && !discordUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <MotionDiv 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
              onClick={() => setShowDiscordPrompt(false)} 
            />
            <MotionDiv 
              initial={{ opacity: 0, y: 150, scale: 0.8 }} 
              animate={{ opacity: 1, y: 0, scale: 1 }} 
              exit={{ opacity: 0, y: 50, scale: 0.9 }} 
              transition={{ type: "spring", bounce: 0.6, duration: 0.7 }}
              className="relative bg-gray-900 border border-[#5865F2]/30 shadow-2xl p-6 pt-12 w-full max-w-sm rounded-xl text-center mt-12"
            >
              {/* Breakout Character Image */}
              <div className="absolute -top-24 left-0 right-0 flex justify-center pointer-events-none z-10">
                <img 
                    src="https://app.fullertonpogo.com/img/character.webp" 
                    alt="Guide" 
                    className="h-32 w-auto drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)]" 
                />
              </div>

              <h3 className="text-xl font-bold text-white mb-2 relative z-20">Friendly Reminder!</h3>
              <p className="text-sm text-gray-400 mb-6 relative z-20">In about a week, we will be locking the Code Distributor and other Host tools exclusively to Verified Ambassadors. Please link your Discord account soon to ensure uninterrupted access!</p>
              
              <div className="space-y-3 relative z-20">
                {/* Primary Discord Button with Watermark */}
                <Button 
                  fullWidth 
                  onClick={() => { setShowDiscordPrompt(false); discordLogin(); }} 
                  className="bg-[#5865F2] hover:bg-[#4752C4] text-white !border-transparent h-14"
                  watermark={
                    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0788.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
                    </svg>
                  }
                >
                  <span className="relative z-10 font-bold text-base tracking-wide">Link Discord Now</span>
                </Button>

                {/* Secondary 'Later' Button with Watermark */}
                <Button 
                  fullWidth 
                  variant="ghost" 
                  onClick={() => setShowDiscordPrompt(false)} 
                  className="text-gray-500 hover:text-white h-12 bg-gray-800/30 hover:bg-gray-800/60 !border-transparent"
                  watermark={<Clock />}
                >
                  <span className="relative z-10">I'll do it later</span>
                </Button>
              </div>
            </MotionDiv>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
