
import React from 'react';
import { Menu } from 'lucide-react';

interface HeaderProps {
  onOpenMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMenu }) => {
  return (
    <header className="absolute top-0 left-0 w-full z-50 pointer-events-none">
      <nav className="flex adaptive-text w-full max-w-[90rem] mx-auto px-8 py-8 items-center justify-between pointer-events-auto">
        <a href="#" className="hover:opacity-80 transition-opacity text-2xl italic text-amber-950 font-serif z-50 relative">
          Zorem
        </a>

        {/* Desktop Menu */}
        <div className="hidden md:flex gap-10 text-green-950 items-center">
          <a href="#services" className="hover:opacity-70 transition-opacity text-lg font-medium">
            Features
          </a>
          <a href="#portfolio" className="hover:opacity-70 transition-opacity text-lg font-medium">
            How it works
          </a>
          <a href="#agency" className="hover:opacity-70 transition-opacity text-lg font-medium">
            Privacy
          </a>
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-4">
          <a 
            href="#register" 
            className="hover:bg-white hover:text-black transition-colors text-lg font-medium text-amber-950 border-green-950 border rounded-full px-6 py-2"
          >
            Register
          </a>
          <a 
            href="#login" 
            className="hover:bg-white hover:text-black transition-colors text-lg font-medium text-amber-950 border-green-950 border rounded-full px-6 py-2"
          >
            Login
          </a>
        </div>

        {/* Mobile Menu Button */}
        <button 
          onClick={onOpenMenu}
          className="md:hidden relative z-50 p-1 hover:bg-black/5 rounded-full transition-colors" 
          aria-label="Menu"
        >
          <Menu className="w-8 h-8 text-amber-950" />
        </button>
      </nav>
    </header>
  );
};
