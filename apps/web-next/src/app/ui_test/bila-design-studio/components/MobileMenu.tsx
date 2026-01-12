
import React from 'react';
import { X } from 'lucide-react';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose }) => {
  return (
    <div 
      className={`fixed inset-0 z-[60] bg-[#Fdfcf8] flex flex-col items-center justify-center transition-all duration-500 ease-in-out md:hidden ${
        isOpen ? 'opacity-100 pointer-events-auto translate-y-0' : 'opacity-0 pointer-events-none -translate-y-full'
      }`}
    >
      <button 
        onClick={onClose}
        className="absolute top-8 right-8 text-slate-900 p-2 hover:bg-black/5 rounded-full transition-colors"
        aria-label="Close menu"
      >
        <X className="w-8 h-8" />
      </button>

      <nav className="flex flex-col items-center gap-8 text-3xl font-serif italic text-slate-900">
        <a href="#services" onClick={onClose} className="hover:text-cyan-600 transition-colors">Features</a>
        <a href="#portfolio" onClick={onClose} className="hover:text-cyan-600 transition-colors">How it works</a>
        <a href="#agency" onClick={onClose} className="hover:text-cyan-600 transition-colors">Privacy</a>
        <a 
          href="#contact" 
          onClick={onClose} 
          className="mt-4 px-8 py-3 border border-slate-900 rounded-full font-sans not-italic text-lg hover:bg-slate-900 hover:text-white transition-all"
        >
          Let's Talk
        </a>
      </nav>
    </div>
  );
};
