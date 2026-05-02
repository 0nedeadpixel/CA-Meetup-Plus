import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { X, Globe, Link as LinkIcon, Loader2, Image as ImageIcon, Clock } from 'lucide-react';
import { Button } from './Button';
import { useToast } from './ToastContext';
import { motion, AnimatePresence } from 'framer-motion';

const MotionDiv = motion.div as any;

interface GlobalSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const Toggle = ({ label, checked, onChange }: any) => (
    <div className="flex justify-between items-center bg-gray-950 border border-gray-800 p-3 rounded">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</span>
        <button onClick={() => onChange(!checked)} className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${checked ? 'bg-purple-500' : 'bg-gray-700'}`}>
            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${checked ? 'translate-x-7' : 'translate-x-1'}`} />
        </button>
    </div>
);

export const GlobalSettingsModal: React.FC<GlobalSettingsModalProps> = ({ isOpen, onClose }) => {
    const [footerText, setFooterText] = useState('Fullerton GO!');
    const [footerLink, setFooterLink] = useState('https://www.instagram.com/fullertonpogo/');

    // Announcement Settings
    const [announceActive, setAnnounceActive] = useState(false);
    const [announceTitle, setAnnounceTitle] = useState('Host Tools Locking Soon!');
    const [announceMessage, setAnnounceMessage] = useState('We are locking the tools to Verified Ambassadors...');
    const [announceImage, setAnnounceImage] = useState('https://app.fullertonpogo.com/img/character.webp');
    const [announceHasTimer, setAnnounceHasTimer] = useState(true);
    const [announceTimerDate, setAnnounceTimerDate] = useState('2026-05-01T23:59');
    const [announceRequireDiscord, setAnnounceRequireDiscord] = useState(true);
    const [announceBtnText, setAnnounceBtnText] = useState('Link Discord Now');
    const [announceBtnUrl, setAnnounceBtnUrl] = useState('');
    const [announceSecBtnActive, setAnnounceSecBtnActive] = useState(false);
    const [announceSecBtnText, setAnnounceSecBtnText] = useState('Support the Developer ☕');
    const [announceSecBtnUrl, setAnnounceSecBtnUrl] = useState('');
    const [announceDismissible, setAnnounceDismissible] = useState(true);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const { addToast } = useToast();

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
                        if (data.announceActive !== undefined) setAnnounceActive(data.announceActive);
                        if (data.announceTitle) setAnnounceTitle(data.announceTitle);
                        if (data.announceMessage) setAnnounceMessage(data.announceMessage);
                        if (data.announceImage) setAnnounceImage(data.announceImage);
                        if (data.announceHasTimer !== undefined) setAnnounceHasTimer(data.announceHasTimer);
                        if (data.announceTimerDate) setAnnounceTimerDate(data.announceTimerDate);
                        if (data.announceRequireDiscord !== undefined) setAnnounceRequireDiscord(data.announceRequireDiscord);
                        if (data.announceBtnText) setAnnounceBtnText(data.announceBtnText);
                        if (data.announceBtnUrl) setAnnounceBtnUrl(data.announceBtnUrl);
                        if (data.announceDismissible !== undefined) setAnnounceDismissible(data.announceDismissible);
                        if (data.announceSecBtnActive !== undefined) setAnnounceSecBtnActive(data.announceSecBtnActive);
                        if (data.announceSecBtnText) setAnnounceSecBtnText(data.announceSecBtnText);
                        if (data.announceSecBtnUrl) setAnnounceSecBtnUrl(data.announceSecBtnUrl);
                    }
                } catch (e) {
                    console.error(e);
                } finally {
                    setLoading(false);
                }
            };
            fetchSettings();
        }
    }, [isOpen]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await setDoc(doc(db, 'global_settings', 'config'), {
                footerText, footerLink, announceActive, announceTitle, announceMessage,
                announceImage, announceHasTimer, announceTimerDate, announceRequireDiscord,
                announceBtnText, announceBtnUrl, announceDismissible,
                announceSecBtnActive, announceSecBtnText, announceSecBtnUrl
            }, { merge: true });
            addToast('Global settings saved!', 'success');
            onClose();
        } catch (e) {
            console.error(e);
            addToast('Failed to save global settings.', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
                <div className="bg-gray-900 border border-purple-500/30 w-full max-w-5xl shadow-2xl relative flex flex-col h-[90vh] md:h-[800px] rounded-xl overflow-hidden">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-950 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500/20 rounded"><Globe className="text-purple-400" size={20} /></div>
                            <div>
                                <h2 className="text-lg font-bold text-white leading-none">Global Launch Control</h2>
                                <p className="text-xs text-gray-400 mt-1">Super Admin Content Management</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button onClick={handleSave} disabled={loading || saving} className="bg-purple-600 hover:bg-purple-500 border-none px-6 h-9 text-sm">
                                {saving ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Publish to All Devices'}
                            </Button>
                            <button onClick={onClose} className="p-2 bg-gray-800 rounded-full text-gray-500 hover:text-white transition-colors"><X size={18} /></button>
                        </div>
                    </div>

                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
                        {/* Left Column: Form Controls */}
                        <div className="p-6 overflow-y-auto border-r border-gray-800 space-y-6">
                            {loading ? ( <div className="flex justify-center py-8"><Loader2 className="animate-spin text-purple-500" size={32} /></div> ) : (
                                <>
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2"><Globe size={16} className="text-purple-500"/> Announcement Modal</h3>
                                        <Toggle label="Enable Global Modal Overlay" checked={announceActive} onChange={setAnnounceActive} />
                                        <Toggle label="Allow Users to Dismiss (Close)" checked={announceDismissible} onChange={setAnnounceDismissible} />
                                        
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Headline</label>
                                            <input type="text" value={announceTitle} onChange={(e) => setAnnounceTitle(e.target.value)} className="w-full bg-gray-950 border border-gray-800 p-3 focus:border-purple-500 outline-none text-white rounded" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Body Message</label>
                                            <textarea rows={3} value={announceMessage} onChange={(e) => setAnnounceMessage(e.target.value)} className="w-full bg-gray-950 border border-gray-800 p-3 focus:border-purple-500 outline-none text-white rounded resize-none text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1 flex items-center gap-1"><ImageIcon size={12}/> Float Image URL</label>
                                            <input type="text" value={announceImage} onChange={(e) => setAnnounceImage(e.target.value)} className="w-full bg-gray-950 border border-gray-800 p-3 focus:border-purple-500 outline-none text-white rounded text-sm" placeholder="https://..." />
                                        </div>
                                    </div>

                                    <div className="space-y-3 pt-6 border-t border-gray-800">
                                        <Toggle label="Enable Countdown Timer" checked={announceHasTimer} onChange={setAnnounceHasTimer} />
                                        {announceHasTimer && (
                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Target Date & Time</label>
                                                <input type="datetime-local" value={announceTimerDate} onChange={(e) => setAnnounceTimerDate(e.target.value)} className="w-full bg-gray-950 border border-gray-800 p-3 focus:border-purple-500 outline-none text-white rounded" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-3 pt-6 border-t border-gray-800">
                                        <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Primary Action Button</h3>
                                        <Toggle label="Require Discord Login" checked={announceRequireDiscord} onChange={setAnnounceRequireDiscord} />
                                        <p className="text-[10px] text-gray-500 -mt-2">If enabled, non-authenticated users will be forced to log in to Discord. If disabled (or if already logged in), they will see your Custom Link below.</p>
                                        
                                        {!announceRequireDiscord && (
                                            <>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Custom Button Text</label>
                                                    <input type="text" value={announceBtnText} onChange={(e) => setAnnounceBtnText(e.target.value)} className="w-full bg-gray-950 border border-gray-800 p-3 focus:border-purple-500 outline-none text-white rounded" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Custom Link URL</label>
                                                    <input type="url" value={announceBtnUrl} onChange={(e) => setAnnounceBtnUrl(e.target.value)} className="w-full bg-gray-950 border border-gray-800 p-3 focus:border-purple-500 outline-none text-white rounded text-sm" placeholder="https://..." />
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <div className="space-y-3 pt-6 border-t border-gray-800">
                                        <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Secondary Action Button</h3>
                                        <Toggle label="Enable Secondary Button" checked={announceSecBtnActive} onChange={setAnnounceSecBtnActive} />
                                        {announceSecBtnActive && (
                                            <>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Button Text</label>
                                                    <input type="text" value={announceSecBtnText} onChange={(e) => setAnnounceSecBtnText(e.target.value)} className="w-full bg-gray-950 border border-gray-800 p-3 focus:border-purple-500 outline-none text-white rounded" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Target URL</label>
                                                    <input type="url" value={announceSecBtnUrl} onChange={(e) => setAnnounceSecBtnUrl(e.target.value)} className="w-full bg-gray-950 border border-gray-800 p-3 focus:border-purple-500 outline-none text-white rounded text-sm" placeholder="https://..." />
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <div className="space-y-3 pt-6 border-t border-gray-800">
                                        <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Footer Overrides</h3>
                                        <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Footer Text</label><input type="text" value={footerText} onChange={(e) => setFooterText(e.target.value)} className="w-full bg-gray-950 border border-gray-800 p-3 outline-none text-white rounded" /></div>
                                        <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Footer Link</label><input type="url" value={footerLink} onChange={(e) => setFooterLink(e.target.value)} className="w-full bg-gray-950 border border-gray-800 p-3 outline-none text-white rounded" /></div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Right Column: Live Preview */}
                        <div className="bg-black/90 relative flex flex-col items-center justify-center p-8 border-l border-purple-500/20">
                            <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 bg-purple-900/30 text-purple-400 text-[10px] font-black uppercase tracking-widest border border-purple-500/30 rounded-full"><div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" /> Live Preview</div>
                            
                            {announceActive ? (
                                <div className="relative bg-gray-900 border border-[#5865F2]/30 shadow-2xl p-6 pt-12 w-full max-w-sm rounded-xl text-center mt-12 transition-all">
                                    {announceImage && (
                                        <div className="absolute -top-24 left-0 right-0 flex justify-center pointer-events-none z-10">
                                            <img src={announceImage} alt="Guide" className="h-32 w-auto drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)] object-contain" />
                                        </div>
                                    )}
                                    <h3 className="text-xl font-bold text-white mb-2 relative z-20">{announceTitle}</h3>
                                    <p className="text-sm text-gray-400 mb-4 relative z-20">{announceMessage}</p>
                                    
                                    {announceHasTimer && (
                                        <div className="flex justify-center gap-2 mb-6 relative z-20 opacity-70">
                                            {['DAYS', 'HRS', 'MIN', 'SEC'].map((label) => (
                                                <div key={label} className="bg-gray-950 border border-[#5865F2]/30 rounded-lg p-2 w-14 text-center shadow-inner">
                                                    <div className="text-lg font-black text-white font-mono">00</div>
                                                    <div className="text-[8px] uppercase tracking-widest text-[#5865F2] font-bold mt-0.5">{label}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    
                                    <div className="space-y-3 relative z-20 flex flex-col items-center">
                                        {/* Primary Button Preview */}
                                        {announceRequireDiscord ? (
                                            <Button fullWidth className="bg-[#5865F2] text-white border-transparent h-12">Discord Login Preview</Button>
                                        ) : (
                                            <Button fullWidth className="bg-purple-600 text-white border-transparent h-12">{announceBtnText}</Button>
                                        )}
                                        
                                        {/* Dismiss Button Preview */}
                                        {announceDismissible && (
                                            <Button fullWidth variant="ghost" className="text-gray-400 hover:text-white h-10 bg-gray-800/30 border-transparent text-sm">I'll do it later</Button>
                                        )}

                                        {/* Secondary Button Preview (Small Text Link) */}
                                        {announceSecBtnActive && (
                                            <button className="text-[11px] text-gray-500 hover:text-purple-400 transition-colors mt-4 uppercase tracking-wider font-bold">
                                                {announceSecBtnText}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-gray-600 text-sm italic flex flex-col items-center gap-4">
                                    <Globe size={48} className="opacity-20" />
                                    Modal is currently hidden from users.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </MotionDiv>
        </AnimatePresence>
    );
};
