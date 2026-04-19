
import React, { useState } from 'react';
// @ts-ignore
import { useLocation } from 'react-router-dom';
import { AmbassadorSettings } from '../types';
import { Flame, Globe, ChevronDown, ChevronUp, ExternalLink, Ticket, Shield } from 'lucide-react';
import { Button } from './Button';
import { PrivacyModal } from './PrivacyModal';

import { Footer } from './Footer';

export const TrainerLanding: React.FC = () => {
    const location = useLocation();
    const profile = location.state?.profile as AmbassadorSettings | undefined;
    const [expanded, setExpanded] = useState(false);

    const communityName = profile?.communityName || 'Our Community';
    const logo = profile?.groupLogo;
    const description = profile?.description;
    const campfireUrl = profile?.campfireUrl;
    const socialUrl = profile?.socialUrl;

    const handleCampfireClick = () => {
        if (campfireUrl) window.open(campfireUrl, '_blank');
    };

    const handleSocialClick = () => {
        if (socialUrl) window.open(socialUrl, '_blank');
    };

    return (
        <div className="min-h-[100dvh] bg-gray-950 text-white flex flex-col relative overflow-hidden">
            
            {/* Rich Animated Background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-900/40 via-gray-950 to-black z-0" />
            <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-blue-500/10 to-transparent pointer-events-none z-0 animate-pulse-slow" />

            <div className="flex-1 z-10 flex flex-col items-center pt-8 px-6 pb-24 overflow-y-auto">
                
                {/* Community Logo with Glow Effect */}
                <div className="relative mb-8">
                    <div className="absolute inset-0 bg-blue-500/30 blur-2xl rounded-full" />
                    <div className="w-36 h-36 rounded-full border-4 border-gray-800 shadow-2xl overflow-hidden bg-black relative z-10 flex items-center justify-center">
                        {logo ? (
                            <img src={logo} alt="Community Logo" className="w-full h-full object-cover" />
                        ) : (
                            <Ticket size={64} className="text-gray-700" />
                        )}
                    </div>
                </div>

                <h2 className="text-xs font-bold text-blue-400 uppercase tracking-[0.2em] mb-3 opacity-80">Thanks for Playing!</h2>
                <h1 className="text-4xl md:text-5xl font-black text-center mb-8 leading-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-gray-200 to-gray-500 drop-shadow-sm">
                    {communityName}
                </h1>

                {/* Glassmorphism Description Box */}
                {description && (
                    <div className="w-full max-w-sm bg-white/5 border border-white/10 backdrop-blur-md p-6 mb-8 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                        <div className={`text-sm text-gray-200 leading-relaxed font-medium ${expanded ? '' : 'line-clamp-4'}`}>
                            {description}
                        </div>
                        {description.length > 150 && (
                            <button 
                                onClick={() => setExpanded(!expanded)} 
                                className="w-full pt-4 mt-2 flex items-center justify-center gap-1.5 text-[10px] uppercase font-bold text-gray-400 hover:text-white transition-colors"
                            >
                                {expanded ? <><ChevronUp size={12}/> Show Less</> : <><ChevronDown size={12}/> Read More</>}
                            </button>
                        )}
                    </div>
                )}

                {/* Call to Actions */}
                <div className="w-full max-w-sm space-y-4">
                    {campfireUrl && (
                        <Button fullWidth onClick={handleCampfireClick} className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 border-none h-16 text-lg shadow-lg shadow-orange-900/30 group relative overflow-hidden">
                            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                            <div className="relative flex items-center justify-center gap-2">
                                <Flame className="fill-current text-orange-200 group-hover:animate-pulse" /> 
                                <span className="font-bold tracking-wide">Join Campfire</span>
                            </div>
                        </Button>
                    )}
                    
                    {socialUrl && (
                        <Button fullWidth variant="secondary" onClick={handleSocialClick} className="h-16 text-lg border-gray-700 bg-gray-900/80 hover:bg-gray-800 backdrop-blur-sm group">
                            <div className="flex items-center justify-center gap-2">
                                <Globe className="text-blue-400 group-hover:text-blue-300 transition-colors" /> 
                                <span className="font-bold tracking-wide">Social / Discord</span>
                                <ExternalLink size={16} className="opacity-50 ml-1"/>
                            </div>
                        </Button>
                    )}
                </div>

                {/* No Links Fallback */}
                {!campfireUrl && !socialUrl && (
                    <div className="text-gray-500 text-sm italic mt-4 bg-gray-900/50 px-4 py-2 rounded-full">
                        Catch you at the next event!
                    </div>
                )}
            </div>

            <Footer />
        </div>
    );
};
