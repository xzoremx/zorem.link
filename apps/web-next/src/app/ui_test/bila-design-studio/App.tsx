
import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Portfolio } from './components/Portfolio';
import { Services } from './components/Services';
import { Footer } from './components/Footer';
import { CookieBanner } from './components/CookieBanner';
import { MobileMenu } from './components/MobileMenu';

const App: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCookieModalOpen, setIsCookieModalOpen] = useState(false);

  // Close mobile menu on escape or resize
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  return (
    <div className="relative min-h-screen">
      <Header onOpenMenu={() => setIsMobileMenuOpen(true)} />
      
      <main className="relative flex flex-col">
        <Hero />
        <section id="intro" className="md:pb-32 -mt-1 bg-[#Fdfcf8] z-20 pt-12 pb-20 relative">
          <div className="md:px-12 max-w-[90rem] mx-auto px-6">
            <div className="max-w-4xl mx-auto text-center mb-32 scroll-mt-32">
              <p className="md:text-5xl leading-[1.15] text-3xl font-medium text-slate-800 tracking-tight">
                We are an independent studio creating{' '}
                <span className="font-serif md:text-6xl text-4xl italic text-cyan-600">
                  digital experiences
                </span>{' '}
                through the design of clear, functional, and sustainable websites.
              </p>
            </div>
            
            <Portfolio />
            <Services />
          </div>
        </section>
        
        <Footer onOpenCookieSettings={() => setIsCookieModalOpen(true)} />
      </main>

      <MobileMenu 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
      />
      
      <CookieBanner 
        isModalOpen={isCookieModalOpen} 
        onSetModalOpen={setIsCookieModalOpen} 
      />
    </div>
  );
};

export default App;
