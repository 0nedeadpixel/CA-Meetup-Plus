import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, onSnapshot, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { X, Globe, Link as LinkIcon, Loader2, Users, Search, Calendar, ShieldCheck, Mail } from 'lucide-react';
import { Button } from './Button';
import { useToast } from './ToastContext';
import { motion, AnimatePresence } from 'framer-motion';

const MotionDiv = motion.div as any;

interface GlobalSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const GlobalSettingsModal: React.FC<GlobalSettingsModalProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<'settings' | 'directory'>('settings');
    const [footerText, setFooterText] = useState('Fullerton GO!');
    const [footerLink, setFooterLink] = useState('https://www.instagram.com/fullertonpogo/');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const { addToast } = useToast();

    const [verifiedUsers, setVerifiedUsers] = useState<any[]>([]);
    const [directorySearchQuery, setDirectorySearchQuery] = useState('');

    useEffect(() => {
        if (isOpen) {
            const fetchSettings = async () => {
                setLoading(true);
                try {
                    const snap = await getDoc(doc(db, 'global_settings', 'config'));
                    if (snap.exists()) {
                        const data = snap.data();
                        if (data.footerText) setFooterText(data.footerText);
                        if (data.footerLink) setFooterLink(data.footerLink);
                    }
                } catch (e) {
                    console.error(e);
                } finally {
                    setLoading(false);
                }
            };
            fetchSettings();

            // Set up snapshot listener for verified users
            const usersRef = collection(db, 'users');
            const unsub = onSnapshot(usersRef, (snapshot) => {
                const usersList: any[] = [];
                snapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    if (data.discordId) {
                        usersList.push({ id: docSnap.id, ...data });
                    }
                });
                setVerifiedUsers(usersList);
            });

            return () => unsub();
        }
    }, [isOpen]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await setDoc(doc(db, 'global_settings', 'config'), {
                footerText,
                footerLink
            }, { merge: true });
            addToast('Global settings saved!', 'success');
        } catch (e) {
            console.error(e);
            addToast('Failed to save global settings.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const filteredUsers = verifiedUsers.filter(u => {
        const query = directorySearchQuery.toLowerCase();
        return (u.discordUsername && u.discordUsername.toLowerCase().includes(query)) ||
               (u.email && u.email.toLowerCase().includes(query));
    });

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <MotionDiv 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
            >
                <div className={`bg-gray-900 border border-purple-500/30 p-6 w-full ${activeTab === 'directory' ? 'max-w-4xl' : 'max-w-md'} shadow-2xl relative transition-all duration-300 flex flex-col max-h-[90vh]`}>
                    <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white z-10">
                        <X size={20} />
                    </button>
                    
                    <div className="flex items-center gap-3 mb-4 shrink-0">
                        <div className="p-2 bg-purple-500/20">
                            <Globe className="text-purple-400" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Global Access</h2>
                            <p className="text-xs text-gray-400">Super Admin Configuration</p>
                        </div>
                    </div>

                    <div className="flex border-b border-gray-800 mb-6 shrink-0">
                        <button 
                            onClick={() => setActiveTab('settings')} 
                            className={`flex-1 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'settings' ? 'border-purple-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                        >
                            App Config
                        </button>
                        <button 
                            onClick={() => setActiveTab('directory')} 
                            className={`flex-1 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'directory' ? 'border-purple-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                        >
                            User Directory
                        </button>
                    </div>

                    {activeTab === 'settings' && (
                        <div className="flex-1 overflow-y-auto">
                            {loading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="animate-spin text-purple-500" size={32} />
                                </div>
                            ) : (
                                <div className="space-y-4 mb-6">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Footer "Made with" Text</label>
                                        <input 
                                            type="text" 
                                            value={footerText}
                                            onChange={(e) => setFooterText(e.target.value)}
                                            className="w-full bg-gray-950 border border-gray-800 p-3 focus:border-purple-500 outline-none text-white"
                                            placeholder="e.g. Fullerton GO!"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Footer Link</label>
                                        <div className="relative">
                                            <LinkIcon className="absolute left-3 top-3.5 text-gray-600" size={18} />
                                            <input 
                                                type="url" 
                                                value={footerLink}
                                                onChange={(e) => setFooterLink(e.target.value)}
                                                className="w-full bg-gray-950 border border-gray-800 py-3 pl-10 pr-3 focus:border-purple-500 outline-none text-white"
                                                placeholder="https://..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <Button fullWidth onClick={handleSave} disabled={loading || saving} className="bg-purple-600 hover:bg-purple-500 border-none shadow-md">
                                {saving ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Save Global Settings'}
                            </Button>
                        </div>
                    )}

                    {activeTab === 'directory' && (
                        <div className="flex flex-col flex-1 overflow-hidden">
                            <div className="mb-4 shrink-0">
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 text-gray-500" size={18} />
                                    <input 
                                        type="text" 
                                        placeholder="Search by Discord name or email..." 
                                        value={directorySearchQuery}
                                        onChange={(e) => setDirectorySearchQuery(e.target.value)}
                                        className="w-full bg-gray-950 border border-gray-800 py-2 pl-10 pr-4 text-sm text-white focus:border-purple-500 outline-none"
                                    />
                                </div>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto border border-gray-800 bg-gray-950">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider sticky top-0 z-10 shadow-md">
                                        <tr>
                                            <th className="p-3 font-bold border-b border-gray-800">Discord User</th>
                                            <th className="p-3 font-bold border-b border-gray-800">Email</th>
                                            <th className="p-3 font-bold border-b border-gray-800 text-center">Role</th>
                                            <th className="p-3 font-bold border-b border-gray-800 text-right">Last Sync</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800">
                                        {filteredUsers.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="p-8 text-center text-gray-500">
                                                    No verified users found.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredUsers.map((u) => (
                                                <tr key={u.id} className="hover:bg-gray-900/50 transition-colors">
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-3">
                                                            {u.discordAvatar ? (
                                                                <img 
                                                                    src={`https://cdn.discordapp.com/avatars/${u.discordId}/${u.discordAvatar}.png`} 
                                                                    alt={u.discordUsername} 
                                                                    className="w-8 h-8 rounded-full border border-gray-700 bg-gray-800"
                                                                />
                                                            ) : (
                                                                <div className="w-8 h-8 rounded-full border border-gray-700 bg-gray-800 flex items-center justify-center">
                                                                    <Users size={14} className="text-gray-500" />
                                                                </div>
                                                            )}
                                                            <div className="font-bold text-white flex items-center gap-1">
                                                                {u.discordUsername}
                                                                {u.discordInServer && <span title="In Server"><ShieldCheck size={14} className="text-green-500 ml-1" /></span>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-gray-300">
                                                        <div className="flex items-center gap-2">
                                                            <Mail size={14} className="text-gray-500" />
                                                            {u.email || 'N/A'}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <span className={`inline-block px-2 py-1 text-[10px] font-bold uppercase rounded-sm border ${u.role === 'super_admin' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : u.role === 'admin' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                                                            {u.role || 'user'}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-right text-gray-400 text-xs">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Calendar size={12} className="text-gray-500" />
                                                            {u.lastDiscordSync ? new Date(u.lastDiscordSync.toMillis ? u.lastDiscordSync.toMillis() : u.lastDiscordSync).toLocaleString() : 'Unknown'}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </MotionDiv>
        </AnimatePresence>
    );
};
