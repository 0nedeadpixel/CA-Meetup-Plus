import React, { useState, useEffect } from "react";
import { X, Users, Shield, ShieldCheck, CheckCircle2, XCircle } from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
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

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const userList: any[] = [];
        querySnapshot.forEach((doc) => {
          userList.push({ id: doc.id, ...doc.data() });
        });
        
        // Filter users who have linked their Discord
        const discordUsers = userList.filter((u) => u.discordId);
        
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
    };

    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

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
        className="relative bg-gray-900 border border-gray-800 shadow-2xl p-0 w-full max-w-4xl max-h-[85vh] flex flex-col rounded-xl overflow-hidden"
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
                <div key={user.id} className="flex items-center justify-between p-4 bg-gray-800/50 border border-gray-700/50 rounded-xl hover:bg-gray-800 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-gray-700 border border-gray-600 flex-shrink-0 overflow-hidden">
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
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{user.discordUsername}</span>
                        {user.role === 'super_admin' && (
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/30">
                            <ShieldCheck size={10} /> Super Admin
                          </span>
                        )}
                        {user.role === 'admin' && (
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">
                            <Shield size={10} /> Admin
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 flex flex-col sm:flex-row sm:items-center sm:gap-3 mt-1">
                        <span>{user.email}</span>
                        {user.profile?.communityName && (
                          <>
                            <span className="hidden sm:inline text-gray-600">•</span>
                            <span className="text-gray-300 font-medium">{user.profile.communityName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border ${
                      user.discordInServer 
                        ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {user.discordInServer ? (
                        <><CheckCircle2 size={14} /> In Server</>
                      ) : (
                        <><XCircle size={14} /> Not In Server</>
                      )}
                    </div>
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
