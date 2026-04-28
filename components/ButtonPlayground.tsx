import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './Button';
import { ArrowLeft, Star, Play, Settings, RefreshCw, XCircle, ArrowRight, Shield, QrCode } from 'lucide-react';

export const ButtonPlayground: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-[100dvh] bg-gray-950 text-white p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto space-y-12">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white border border-gray-700">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black italic tracking-tight text-white mb-1">Button Playground</h1>
                        <p className="text-gray-400 text-sm">Super Admin Preview of all Button variants and features.</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <h2 className="text-xl font-bold border-b border-gray-800 pb-2">1. Themed Variants (Default)</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                        <Button variant="primary" icon={<Play size={18} />}>Primary</Button>
                        <Button variant="secondary" icon={<Settings size={18} />}>Secondary</Button>
                        <Button variant="danger" icon={<XCircle size={18} />}>Danger</Button>
                        <Button variant="ghost" icon={<RefreshCw size={18} />}>Ghost</Button>
                        <Button variant="niantic" icon={<Star size={18} />}>Niantic</Button>
                        <Button variant="purple" icon={<Shield size={18} />}>Purple</Button>
                    </div>
                </div>

                <div className="space-y-6">
                    <h2 className="text-xl font-bold border-b border-gray-800 pb-2">2. Watermark Mode</h2>
                    <p className="text-xs text-gray-500 mb-4">Adding a watermark element fades it into the background, scaling and rotating on hover for a dynamic effect.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Button 
                            variant="primary" 
                            watermark={<Star />}
                        >
                            <span className="relative z-10">Premium Member</span>
                        </Button>
                        
                        <Button 
                            variant="danger" 
                            watermark={<Shield />}
                        >
                            <span className="relative z-10">Delete Everything</span>
                        </Button>
                        
                        <Button 
                            variant="purple" 
                            watermark={<QrCode />}
                        >
                            <span className="relative z-10">Scan Code</span>
                        </Button>
                    </div>
                </div>

                <div className="space-y-6">
                    <h2 className="text-xl font-bold border-b border-gray-800 pb-2">3. Full Width & Custom Classes</h2>
                    <div className="space-y-4">
                        <Button 
                            variant="primary" 
                            fullWidth 
                            icon={<ArrowRight />}
                            className="h-16 text-xl shadow-lg shadow-blue-900/20"
                            watermark={<Play />}
                        >
                            Start Live Session
                        </Button>

                        <Button 
                            variant="niantic" 
                            fullWidth 
                            className="animate-pulse-slow h-20 text-2xl"
                            watermark={<Star />}
                        >
                            Claim Ultimate Reward
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
