
import React from 'react';
import { Quote } from 'lucide-react';

interface FooterProps {
  onOpenCookieSettings: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenCookieSettings }) => {
  return (
    <section id="contact" className="bg-[#Fdfcf8] pb-6 px-4 md:px-6 relative z-30">
      <div className="w-full max-w-[90rem] mx-auto bg-[#07201D] rounded-[2.5rem] md:rounded-[3.5rem] text-[#F0F7F6] py-20 px-6 md:px-20 relative overflow-hidden shadow-2xl flex flex-col items-center text-center">
        
        <div className="flex justify-center mb-8 opacity-10 text-cyan-400">
          <Quote className="w-14 h-14" fill="currentColor" />
        </div>

        <div className="max-w-5xl mx-auto mb-16">
          <h2 className="md:text-7xl leading-[1.1] text-4xl text-white tracking-tight font-serif mb-8">
            "Everything you can imagine is real"
          </h2>
          <p className="md:text-sm uppercase text-xs font-medium text-cyan-400/50 tracking-[0.25em]">
            — pablo Picasso
          </p>
        </div>

        <div className="w-full h-px bg-white/5 mb-16 max-w-6xl mx-auto" />

        <div className="flex flex-col gap-10 w-full items-center justify-center">
          <div className="flex items-center gap-3 text-cyan-400/60 uppercase tracking-[0.15em] text-xs font-bold">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-600/80" />
            <span>Lima, Peru</span>
          </div>

          <nav className="flex flex-wrap justify-center gap-8 md:gap-16 text-cyan-100/80 uppercase tracking-[0.15em] text-xs font-bold">
            <a href="#services" className="hover:text-white transition-colors">Features</a>
            <a href="#portfolio" className="hover:text-white transition-colors">How it works</a>
            <a href="#contact" className="hover:text-white transition-colors">Contact</a>
          </nav>

          <nav className="flex flex-wrap justify-center gap-6 md:gap-8 text-cyan-400/30 uppercase tracking-[0.1em] text-[10px] font-medium">
            <a href="#" className="hover:text-cyan-200/50 transition-colors">Legal Notice</a>
            <button onClick={onOpenCookieSettings} className="hover:text-cyan-200/50 transition-colors uppercase tracking-[0.1em] text-[10px] font-medium">
              Cookie Settings
            </button>
            <a href="#" className="hover:text-cyan-200/50 transition-colors">Privacy Policy</a>
          </nav>

          <div className="flex items-center gap-3 text-cyan-400/40 text-xs mt-4">
            <span className="font-serif italic text-2xl text-white opacity-90">Zorem</span>
            <span className="tracking-widest text-[10px] mt-1">© 2026</span>
          </div>
        </div>
      </div>
    </section>
  );
};
