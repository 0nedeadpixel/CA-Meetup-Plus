import React, { useState, useEffect, useCallback } from "react";
import { X, Users, Shield, ShieldCheck, CheckCircle2, XCircle } from "lucide-react";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { motion, AnimatePresence } from "framer-motion";

const MotionDiv = motion.div as any;

interface AmbassadorDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AmbassadorDirectoryModal: React.FC<AmbassadorDirectoryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Guest/Discord directory
      const dirSnapshot = await getDocs(collection(db, "ambassador_directory"));
      // 2. Fetch Admin users directory
      const usersSnapshot = await getDocs(collection(db, "users"));
      
      const combinedMap = new Map();

      // Add everyone from the admin users collection who has a Discord ID
      usersSnapshot.forEach((document) => {
        const data = document.data();
        if (data.discordId) {
          combinedMap.set(data.discordId, { id: document.id, ...data });
        }
      });

      // Add/Merge everyone from the ambassador_directory
      dirSnapshot.forEach((document) => {
        const data = document.data();
        if (combinedMap.has(data.discordId)) {
          // Merge with existing admin data
          const existing = combinedMap.get(data.discordId);
          combinedMap.set(data.discordId, { 
            ...existing, 
            ...data, 
            profile: existing.profile || { communityName: data.communityName } 
          });
        } else {
          // Add new guest user
          combinedMap.set(data.discordId, { 
            id: document.id, 
            ...data,
            role: data.role || 'user',
            email: 'Guest Auth',
            profile: { communityName: data.communityName }
          });
        }
      });

      const discordUsers = Array.from(combinedMap.values());
      
      // Sort: Super Admins first, then Admins, then standard users
      discordUsers.sort((a, b) => {
        const roleA = a.role || 'user';
        const roleB = b.role || 'user';
        if (roleA === 'super_admin' && roleB !== 'super_admin') return -1;
        if (roleA !== 'super_admin' && roleB === 'super_admin') return 1;
        if (roleA === 'admin' && roleB !== 'admin') return -1;
        if (roleA !== 'admin' && roleB === 'admin') return 1;
        return 0;
      });

      setUsers(discordUsers);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleHostRole = async (discordId: string, currentRole: string) => {
    try {
      const newRole = currentRole === 'host' ? 'user' : 'host';
      await setDoc(doc(db, "ambassador_directory", discordId), { role: newRole }, { merge: true });
      // The real-time listener in the modal's fetchUsers will pick this up automatically if set up correctly, 
      // but to be safe, manually trigger a re-fetch:
      fetchUsers();
    } catch (err) {
      console.error("Failed to update role", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen, fetchUsers]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <MotionDiv
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      <MotionDiv
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative bg-gray-900 border border-gray-800 shadow-2xl p-0 w-full max-w-lg max-h-[85vh] flex flex-col rounded-xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-gray-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
              <Users size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Ambassador Directory</h2>
              <p className="text-sm text-gray-400">Manage users with linked Discord accounts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : users.length > 0 ? (
            <div className="grid gap-3">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 bg-gray-800/50 border border-gray-700/50 rounded-xl hover:bg-gray-800 transition-colors gap-2">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-gray-700 flex-shrink-0 overflow-hidden border-2 ${user.discordInServer ? 'border-green-500' : 'border-gray-600'}`}>
                      {user.discordAvatar ? (
                        <img 
                          src={`https://cdn.discordapp.com/avatars/${user.discordId}/${user.discordAvatar}.png`} 
                          alt={user.discordUsername}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-gray-400 font-bold bg-indigo-600/20 text-indigo-400">
                          {user.discordUsername?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                    
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white truncate max-w-[120px] sm:max-w-[200px]">{user.discordUsername}</span>
                      </div>
                      <div className="text-xs text-gray-400 flex flex-col sm:flex-row sm:items-center sm:gap-2 mt-1 truncate">
                        {user.email !== 'Guest Auth' && (
                          <span className="truncate">{user.email}</span>
                        )}
                        {user.profile?.communityName && (
                          <>
                            {user.email !== 'Guest Auth' && (
                              <span className="hidden sm:inline text-gray-600 shrink-0">•</span>
                            )}
                            <span className="text-gray-300 font-medium truncate">{user.profile.communityName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center shrink-0">
                    {user.role === 'super_admin' && (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/30">
                        <ShieldCheck size={10} /> <span className="hidden sm:inline">Super Admin</span><span className="sm:hidden">Admin</span>
                      </span>
                    )}
                    {user.role === 'admin' && (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">
                        <Shield size={10} /> Admin
                      </span>
                    )}
                    {user.role !== 'super_admin' && user.role !== 'admin' && (
                      <button 
                        onClick={() => toggleHostRole(user.discordId, user.role || 'user')}
                        className={`px-3 py-1.5 text-[10px] font-bold rounded-full border whitespace-nowrap transition-colors ${user.role === 'host' ? 'bg-purple-900/30 text-purple-400 border-purple-500/50 hover:bg-purple-900/50' : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'}`}
                      >
                        {user.role === 'host' ? 'Revoke Host' : 'Make Host'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Users size={48} className="mx-auto mb-4 opacity-20" />
              <p>No ambassadors found with linked Discord accounts.</p>
            </div>
          )}
        </div>
      </MotionDiv>
    </div>
  );
};
