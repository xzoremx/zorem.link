
import React from 'react';
import { ArrowRight } from 'lucide-react';

export const Hero: React.FC = () => {
  return (
    <section className="flex flex-col overflow-hidden animate-gradient-bg md:min-h-[110vh] md:pt-40 min-h-[90vh] w-full z-0 pt-32 relative items-center justify-start">
      {/* Hero Content */}
      <div className="relative z-10 text-center px-4 adaptive-text mt-12 md:mt-20 pb-40">
        <h1 className="text-[15vw] md:text-[12vw] leading-[0.85] tracking-tighter opacity-95 animate-fade-in-up">
          Rate <br /> <span className="font-light italic opacity-90 font-serif"> ephemeral stories</span>
        </h1>
      </div>

      {/* Hill Overlay */}
      <div className="hill-curve flex bg-[#Fdfcf8] w-full h-[35vh] z-20 absolute bottom-0 left-0 shadow-[0_-20px_60px_rgba(0,0,0,0.1)] justify-center items-start pt-12 md:pt-16">
        <a 
          href="#intro" 
          className="animate-gradient-bg group relative flex items-center gap-2 text-sm font-medium text-slate-800 rounded-full px-8 py-4 shadow-xl hover:scale-105 transition-all duration-300"
        >
          <span className="group-hover:text-black transition-colors tracking-tight">
            create a room
          </span>
          <ArrowRight className="w-4 h-4 text-stone-700 group-hover:text-black group-hover:translate-x-1 transition-transform" />
        </a>
      </div>
      
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(60px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
      `}</style>
    </section>
  );
};
