
import React, { useState, useEffect } from 'react';
import { X, ShieldCheck } from 'lucide-react';
import { CookieConsent } from '../types';

interface CookieBannerProps {
  isModalOpen: boolean;
  onSetModalOpen: (open: boolean) => void;
}

export const CookieBanner: React.FC<CookieBannerProps> = ({ isModalOpen, onSetModalOpen }) => {
  const [showBanner, setShowBanner] = useState(false);
  const [consent, setConsent] = useState<CookieConsent>({
    necessary: true,
    analytics: false,
    marketing: false
  });

  useEffect(() => {
    const saved = localStorage.getItem('bila_cookie_consent');
    if (!saved) {
      const timer = setTimeout(() => setShowBanner(true), 1500);
      return () => clearTimeout(timer);
    } else {
      setConsent(JSON.parse(saved));
    }
  }, []);

  const handleSave = (newConsent: CookieConsent) => {
    localStorage.setItem('bila_cookie_consent', JSON.stringify(newConsent));
    setConsent(newConsent);
    setShowBanner(false);
    onSetModalOpen(false);
  };

  if (!showBanner && !isModalOpen) return null;

  return (
    <>
      {/* Small Banner */}
      {showBanner && !isModalOpen && (
        <div className="fixed bottom-8 right-4 md:bottom-8 md:right-8 z-50 max-w-sm w-[calc(100%-2rem)] bg-white/90 backdrop-blur-md border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-2xl p-6 transform transition-all duration-500 flex flex-col gap-4 animate-slide-up">
          <div>
            <div className="flex items-center gap-2 text-slate-900 font-semibold mb-2">
              <ShieldCheck className="w-[18px] h-[18px]" />
              <span>Privacy & Cookies</span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">
              We use cookies to improve your experience and analyze our traffic. You can choose your preferences.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 w-full">
              <button 
                onClick={() => handleSave({ ...consent, analytics: false, marketing: false })}
                className="flex-1 py-2.5 px-4 rounded-lg border border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Decline
              </button>
              <button 
                onClick={() => handleSave({ ...consent, analytics: true, marketing: true })}
                className="flex-1 uppercase hover:bg-cyan-700 transition-colors text-xs font-bold text-white tracking-wider bg-slate-900 rounded-lg py-2.5 shadow-lg"
              >
                Accept
              </button>
            </div>
            <button 
              onClick={() => onSetModalOpen(true)}
              className="w-full py-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest hover:text-slate-800 transition-colors underline decoration-slate-200 underline-offset-4"
            >
              Cookie Settings
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[70] bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-blur-in">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-serif text-2xl italic text-slate-900">Cookie Preferences</h3>
              <button 
                onClick={() => onSetModalOpen(false)}
                className="text-slate-400 hover:text-slate-900 transition-colors p-2 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
              <p className="text-sm text-slate-500">
                Manage your consent preferences for the different cookie categories used on our site.
              </p>

              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 text-sm mb-1">Essential Cookies</p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Necessary for the technical operation of the site. Cannot be disabled.
                  </p>
                </div>
                <div className="w-11 h-6 bg-slate-300 rounded-full opacity-50 relative">
                    <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                </div>
              </div>

              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 text-sm mb-1">Analytics & Performance</p>
                  <p className="text-xs text-slate-500 leading-relaxed">Help us understand how you interact with the site to improve it.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={consent.analytics}
                    onChange={(e) => setConsent({ ...consent, analytics: e.target.checked })}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900" />
                </label>
              </div>

              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 text-sm mb-1">Marketing</p>
                  <p className="text-xs text-slate-500 leading-relaxed">Used to display relevant advertisements on other sites.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={consent.marketing}
                    onChange={(e) => setConsent({ ...consent, marketing: e.target.checked })}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900" />
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={() => onSetModalOpen(false)}
                className="px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleSave(consent)}
                className="px-6 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-bold uppercase tracking-wider hover:bg-cyan-700 transition-colors shadow-lg"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes blurIn {
          from { opacity: 0; filter: blur(10px); transform: scale(0.95); }
          to { opacity: 1; filter: blur(0); transform: scale(1); }
        }
        .animate-slide-up { animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-blur-in { animation: blurIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </>
  );
};
