import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Shield } from 'lucide-react';
import { PrivacyModal } from './PrivacyModal';

export const Footer: React.FC = () => {
    const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
    const [footerText, setFooterText] = useState('Fullerton GO!');
    const [footerLink, setFooterLink] = useState('https://www.instagram.com/fullertonpogo/');

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const snap = await getDoc(doc(db, 'global_settings', 'config'));
                if (snap.exists()) {
                    const data = snap.data();
                    if (data.footerText) setFooterText(data.footerText);
                    if (data.footerLink) setFooterLink(data.footerLink);
                }
            } catch (e) {
                console.error("Failed to fetch global settings", e);
            }
        };
        fetchSettings();
    }, []);

    return (
        <>
            <PrivacyModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />
            <div className="p-5 border-t border-white/5 flex items-center justify-between bg-black/40 backdrop-blur-xl sticky bottom-0 z-30 shrink-0 w-full">
                <a href={footerLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 group">
                    <img src="https://app.fullertonpogo.com/images/logo.png" alt="Logo" className="w-8 h-8 object-contain shrink-0 opacity-60 group-hover:opacity-100 transition-opacity grayscale group-hover:grayscale-0" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    <div className="flex flex-col text-left">
                        <p className="text-[10px] text-gray-500 leading-tight group-hover:text-gray-400 transition-colors">
                            Made with ❤️ by <span className="font-bold">{footerText}</span>
                        </p>
                    </div>
                </a>
                <button onClick={() => setIsPrivacyOpen(true)} className="text-gray-600 hover:text-white p-2 transition-colors">
                    <Shield size={18} />
                </button>
            </div>
        </>
    );
};
