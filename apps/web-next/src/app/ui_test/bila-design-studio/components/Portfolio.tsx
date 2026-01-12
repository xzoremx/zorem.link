
import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Project } from '../types';

const PROJECTS: Project[] = [
  { id: '1', title: 'Orion security', category: 'Private security, web project', colors: ['#E8E6E1', 'bg-cyan-400'] },
  { id: '2', title: 'Fremont-Bousso', category: 'Independent lawyer, web project', colors: ['#E8E6E1', 'bg-red-500', 'bg-green-500'] },
  { id: '3', title: 'FOCUS emlyon', category: 'Audiovisual association, web project', colors: ['#E8E6E1', 'bg-[#AA7A56]', 'bg-[#232F42]'] },
  { id: '4', title: 'Auravocats', category: 'Law firm, web project', colors: ['#E8E6E1', 'bg-[#6EC6D9]', 'bg-green-400'] },
];

export const Portfolio: React.FC = () => {
  return (
    <div id="portfolio" className="grid grid-cols-1 md:grid-cols-2 md:gap-y-32 gap-x-12 gap-y-20 scroll-mt-32">
      {PROJECTS.map((project, index) => (
        <article 
          key={project.id} 
          className={`group cursor-pointer ${index % 2 !== 0 ? 'md:mt-24' : ''}`}
        >
          <div className="relative w-full aspect-[4/3] overflow-hidden rounded-2xl bg-slate-200 mb-6">
            <div className="absolute inset-0 bg-slate-300 group-hover:scale-105 transition-transform duration-700 ease-in-out">
              <div className="w-full h-full flex items-center justify-center bg-[#E8E6E1]">
                {project.colors.slice(1).map((color, idx) => (
                  <div 
                    key={idx}
                    className={`w-32 h-32 rounded-full ${color} mix-blend-multiply filter blur-2xl opacity-60 ${idx > 0 ? '-ml-12' : ''}`}
                  />
                ))}
              </div>
            </div>
            <div className="group-hover:bg-black/10 transition-colors duration-500 bg-black/0 absolute inset-0" />
          </div>
          
          <div className="flex justify-between items-center border-t border-slate-300 pt-5 min-h-[5rem]">
            <div>
              <h3 className="md:text-4xl leading-none text-3xl text-slate-900 mb-1">
                {project.title}
              </h3>
              <span className="text-lg text-slate-500">
                {project.category}
              </span>
            </div>
            
            <div className="opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0 ease-out">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm text-xs font-bold uppercase tracking-widest text-slate-900 hover:bg-slate-900 hover:text-white transition-colors duration-300">
                View site
                <ArrowUpRight className="w-4 h-4" />
              </span>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
};
