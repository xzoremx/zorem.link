
import React, { useState } from 'react';
import { Plus, ArrowRight } from 'lucide-react';
import { Service } from '../types';

const SERVICES: Service[] = [
  {
    id: '1',
    title: 'Websites',
    description: 'Design of immersive and high-performance digital platforms. We use next-generation tools to quickly design reliable, clear, and effective websites.',
    tags: ['UX/UI Design', 'Development', 'E-commerce']
  },
  {
    id: '2',
    title: 'Rebranding',
    description: 'Complete overhaul of brand identity. We redefine your visual and verbal territory to ensure total consistency across all touchpoints, from logo to marketing materials.',
    tags: ['Logo', 'Art Direction', 'Brand Guidelines']
  },
  {
    id: '3',
    title: 'Audit & Strategy',
    description: 'In-depth analysis of your online presence and definition of a clear roadmap. We identify growth opportunities to maximize your digital impact.',
    tags: ['UX Audit', 'Positioning', 'Content']
  },
  {
    id: '4',
    title: 'SEO Strategy',
    description: 'Analysis of your online visibility and definition of strategies adapted to your objectives. We mobilize different SEO levers to identify concrete growth axes.',
    tags: ['SEO Audit', 'Organic Search', 'Search Results']
  }
];

export const Services: React.FC = () => {
  const [activeService, setActiveService] = useState<string | null>(null);

  return (
    <div id="services" className="mt-40 mb-20 scroll-mt-32">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
        <div className="md:col-span-4 flex flex-col items-start">
          <h2 className="md:text-5xl font-serif text-4xl italic text-slate-900 mb-8">
            Our Expertise
          </h2>
          <a 
            href="#portfolio" 
            className="inline-flex items-center gap-3 hover:bg-cyan-600 transition-all duration-300 hover:shadow-xl group text-lg font-medium text-white bg-slate-900 rounded-full px-8 py-4 shadow-lg"
          >
            View Portfolio
            <ArrowRight className="group-hover:translate-x-1 transition-transform" />
          </a>
        </div>

        <div className="md:col-span-8 flex flex-col">
          {SERVICES.map((service) => (
            <div 
              key={service.id}
              onMouseEnter={() => setActiveService(service.id)}
              onMouseLeave={() => setActiveService(null)}
              className="group py-8 border-b border-slate-300 cursor-pointer overflow-hidden transition-all duration-500"
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`md:text-3xl text-2xl font-medium transition-colors duration-300 ${activeService === service.id ? 'text-slate-900' : 'text-slate-400'}`}>
                  {service.title}
                </span>
                <div className={`w-10 h-10 flex items-center justify-center rounded-full border transition-all duration-300 ${activeService === service.id ? 'bg-slate-900 border-slate-900' : 'border-slate-300'}`}>
                  <Plus className={`w-5 h-5 transition-all duration-300 ${activeService === service.id ? 'text-white rotate-90' : 'text-stone-400'}`} />
                </div>
              </div>
              
              <div className={`grid transition-all duration-500 ease-out ${activeService === service.id ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                  <div className={`pt-4 transition-opacity duration-700 max-w-2xl ${activeService === service.id ? 'opacity-100' : 'opacity-0'}`}>
                    <p className="leading-relaxed text-lg font-light text-slate-600">
                      {service.description}
                    </p>
                    <div className="flex flex-wrap gap-3 mt-4 text-sm font-medium text-cyan-600 uppercase tracking-wide">
                      {service.tags.map(tag => <span key={tag}>• {tag}</span>)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
