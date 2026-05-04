import React, { useState, useEffect, useCallback } from "react";
import { X, ShieldCheck, ShieldAlert, Search, Trash2, Check, Shield, Users, Clock, Globe, ExternalLink } from 'lucide-react';
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
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
      
      // Sort: Users (Pending Hosts) first, then Super Admins, then Admins, then Hosts
      discordUsers.sort((a, b) => {
        const roleA = a.role || 'user';
        const roleB = b.role || 'user';
        
        const aIsUser = roleA === 'user';
        const bIsUser = roleB === 'user';
        if (aIsUser && !bIsUser) return -1;
        if (!aIsUser && bIsUser) return 1;

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

  const removeDiscordUser = async (user: any) => {
    if (!window.confirm(`Are you sure you want to remove ${user.discordUsername || 'this user'}?`)) return;
    try {
      if (user.id !== user.discordId) {
        // They are an admin/ambassador with a linked discord in the "users" collection
        await setDoc(doc(db, "users", user.id), {
          discordId: null,
          discordUsername: null,
          discordAvatar: null
        }, { merge: true });
      }
      
      // Delete from ambassador_directory (wrap in try-catch in case it doesn't exist)
      try {
        await deleteDoc(doc(db, "ambassador_directory", user.discordId));
      } catch (e) {
        console.warn("User not in ambassador_directory collection", e);
      }
      
      fetchUsers();
    } catch (err) {
      console.error("Failed to remove user", err);
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
                    <div className={`h-12 w-12 rounded-full flex-shrink-0 overflow-hidden border-2 ${
                      (user.role === 'super_admin' || user.role === 'admin') 
                        ? 'border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' 
                        : (user.discordInServer || user.role === 'host')
                        ? 'border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]'
                        : 'border-gray-600 bg-gray-700'
                    }`}>
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
                      <div className="font-bold text-white text-base flex items-center gap-1">
                          <a 
                              href={`https://discord.com/users/${user.discordId}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="hover:text-[#5865F2] transition-colors hover:underline flex items-center gap-1"
                              title="Open Discord Profile"
                          >
                              {user.discordUsername || 'Unknown User'}
                              <ExternalLink size={12} className="opacity-50" />
                          </a>
                      </div>
                      <div className="text-xs text-gray-400 flex flex-col mt-1 truncate">
                        {user.email !== 'Guest Auth' && (
                          <span className="truncate">{user.email}</span>
                        )}
                        {user.profile?.communityName && (
                          <span className="text-[10px] text-gray-300 font-medium truncate">{user.profile.communityName}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center shrink-0 gap-2">
                    <button 
                      onClick={() => toggleHostRole(user.discordId, user.role || 'user')}
                      className={`mt-2 px-3 py-1 text-xs font-bold rounded-full border transition-colors ${user.role === 'host' ? 'bg-purple-900/30 text-purple-400 border-purple-500/50 hover:bg-purple-900/50' : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'}`}
                    >
                      {user.role === 'host' ? 'Revoke Host' : 'Make Host'}
                    </button>
                    <button
                      onClick={() => removeDiscordUser(user)}
                      className="mt-2 p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-full transition-colors"
                      title="Remove User"
                    >
                      <Trash2 size={16} />
                    </button>
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
