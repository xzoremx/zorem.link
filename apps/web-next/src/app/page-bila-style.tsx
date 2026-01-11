'use client';

/**
 * Zorem Landing Page - Bila Design Studio Style
 * Replicates the exact aesthetic and animations from Bila
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/context';
import { api } from '@/lib';

export default function LandingPageBilaStyle() {
  const { isAuthenticated, user, logout } = useAuth();
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleJoinRoom = async () => {
    if (!roomCode || roomCode.length !== 6) return;

    try {
      const result = await api.rooms.validateCode(roomCode);
      if (result.valid) {
        router.push(`/nickname?code=${roomCode}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateRoom = () => {
    if (isAuthenticated) {
      router.push('/create-room');
    } else {
      router.push('/auth');
    }
  };

  return (
    <div className="bg-[#Fdfcf8] text-stone-900 antialiased selection:bg-teal-200 selection:text-teal-900 relative w-full overflow-x-hidden">
      <style jsx global>{`
        /* Base Fonts */
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:wght@400;500;600;700&display=swap');

        body {
          font-family: 'Manrope', sans-serif;
        }

        h1, h2, h3, h4, .serif {
          font-family: 'Instrument Serif', serif;
        }

        .font-instrument-serif {
          font-family: 'Instrument Serif', serif !important;
        }

        .font-manrope {
          font-family: 'Manrope', sans-serif !important;
        }

        ::-webkit-scrollbar {
          width: 0px;
          background: transparent;
        }

        /* Custom Hill Curve */
        .hill-curve {
          border-top-left-radius: 50% 100px;
          border-top-right-radius: 50% 100px;
        }

        @media (min-width: 768px) {
          .hill-curve {
            border-top-left-radius: 50% 240px;
            border-top-right-radius: 50% 240px;
          }
        }

        /* Hero Animation */
        @keyframes heroReveal {
          from { opacity: 0; transform: translateY(60px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-hero-reveal {
          animation: heroReveal 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          opacity: 0;
          animation-delay: 0.3s;
        }

        /* Gradient Animation */
        @keyframes gradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .animate-gradient-bg {
          background: linear-gradient(-45deg, #ffc3a0, #ffafbd, #c2e9fb, #e2ebf0, #d4fc79, #96e6a1);
          background-size: 400% 400%;
          animation: gradientMove 8s ease infinite;
        }

        /* Adaptive Text (Mix Blend Mode for Header) */
        .adaptive-text {
          color: #ffffff;
          mix-blend-mode: difference;
        }

        /* Blur In Animation */
        @keyframes blurIn {
          from { opacity: 0; filter: blur(10px); transform: scale(0.95); }
          to { opacity: 1; filter: blur(0); transform: scale(1); }
        }

        .animate-blur-in {
          animation: blurIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        /* Border Gradient */
        [style*="--border-gradient"]::before {
          content: "";
          position: absolute;
          inset: 0;
          padding: 1px;
          border-radius: var(--border-radius-before, inherit);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          background: var(--border-gradient);
          pointer-events: none;
        }
      `}</style>

      {/* COMMON HEADER START */}
      <header className="absolute top-0 left-0 w-full z-50 pointer-events-none">
        <nav className="flex adaptive-text w-full max-w-[90rem] mx-auto px-8 py-8 items-center justify-between pointer-events-auto">
          <Link href="/" className="hover:opacity-80 transition-opacity text-2xl italic text-amber-950 font-instrument-serif z-50 relative">
            Zorem.
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex gap-10 text-green-950 items-center">
            <a href="#features" className="hover:opacity-70 transition-opacity text-lg font-medium">
              Features
            </a>
            <a href="#use-cases" className="hover:opacity-70 transition-opacity text-lg font-medium">
              Use Cases
            </a>
            <a href="#how-it-works" className="hover:opacity-70 transition-opacity text-lg font-medium">
              How it Works
            </a>
          </div>

          {/* Desktop CTA */}
          {isAuthenticated ? (
            <div className="hidden md:flex items-center gap-4">
              <Link href="/my-rooms" className="text-lg font-medium text-amber-950 hover:opacity-70 transition-opacity">
                My Rooms
              </Link>
              <button
                onClick={logout}
                className="text-lg font-medium text-amber-950 border-green-950 border rounded-full pt-2 pr-6 pb-2 pl-6 hover:bg-white hover:text-black transition-colors"
              >
                Log out
              </button>
            </div>
          ) : (
            <Link
              href="/auth"
              className="hidden hover:bg-white hover:text-black transition-colors md:block text-lg font-medium text-amber-950 border-green-950 border rounded-full pt-2 pr-6 pb-2 pl-6"
            >
              Sign In
            </Link>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden relative z-50 p-1"
            aria-label="Menu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-0' : 'opacity-100'}`}
            >
              <path d="M4 12h16"></path>
              <path d="M4 6h16"></path>
              <path d="M4 18h16"></path>
            </svg>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-opacity duration-300 absolute top-1 left-1 ${mobileMenuOpen ? 'opacity-100' : 'opacity-0'}`}
            >
              <path d="M18 6 6 18"></path>
              <path d="m6 6 12 12"></path>
            </svg>
          </button>
        </nav>
      </header>
      {/* COMMON HEADER END */}

      {/* Main Wrapper */}
      <main className="relative w-full flex flex-col">
        {/* Hero Section */}
        <section className="flex flex-col overflow-hidden animate-gradient-bg md:min-h-[110vh] md:pt-40 min-h-[90vh] w-full z-0 pt-32 relative items-center justify-start">
          {/* Hero Content */}
          <div className="relative z-10 text-center px-4 adaptive-text mt-12 md:mt-20 pb-40">
            <h1 className="text-[15vw] md:text-[12vw] leading-[0.85] animate-hero-reveal tracking-tighter opacity-95">
              Private <br />
              <span className="font-light italic opacity-90">Stories</span>
            </h1>
          </div>

          {/* Hill Overlay */}
          <div className="hill-curve flex bg-[#Fdfcf8] w-full h-[35vh] z-20 absolute bottom-0 left-0 shadow-[0_-20px_60px_rgba(0,0,0,0.1)] justify-center items-start pt-12 md:pt-16">
            <a
              href="#intro"
              className="animate-gradient-bg hover:opacity-90 transition-all flex gap-x-2 gap-y-2 items-center group text-sm font-medium text-slate-900 rounded-full pt-3 pr-6 pb-3 pl-6"
              style={{
                boxShadow: 'rgba(31, 41, 55, 0.25) 0px 18px 35px, rgba(209, 213, 219, 0.3) 0px 0px 0px 1px',
                position: 'relative',
                '--border-gradient': 'linear-gradient(180deg, rgba(255, 255, 255, 0.8), rgba(0, 0, 0, 0.4), rgba(255, 255, 255, 0.8))',
                '--border-radius-before': '9999px',
              } as React.CSSProperties}
            >
              <span className="group-hover:text-black transition-colors text-sm font-medium text-slate-800 tracking-tight">
                Discover
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4 text-stone-700 group-hover:text-black transition-colors group-hover:translate-x-0.5 duration-300"
              >
                <path d="M5 12h14"></path>
                <path d="m12 5 7 7-7 7"></path>
              </svg>
            </a>
          </div>
        </section>

        {/* Editorial Content Section */}
        <section id="intro" className="md:pb-32 -mt-1 bg-[#Fdfcf8] z-20 pt-12 pb-20 relative">
          <div className="md:px-12 max-w-[90rem] mx-auto px-6">
            {/* Statement */}
            <div id="features" className="max-w-4xl mx-auto text-center mb-32 scroll-mt-32">
              <p className="md:text-5xl leading-[1.15] text-3xl font-medium text-slate-800 tracking-tight">
                Share ephemeral stories with{' '}
                <span className="serif md:text-6xl text-4xl italic text-cyan-600">
                  a select few
                </span>{' '}
                through private, temporary rooms that vanish after the time you set.
              </p>
            </div>

            {/* Features Grid */}
            <div id="use-cases" className="grid grid-cols-1 md:grid-cols-2 md:gap-y-32 gap-x-12 gap-y-20 scroll-mt-32">
              {/* Feature 1: Private Parties */}
              <article className="group cursor-pointer">
                <div className="relative w-full aspect-[4/3] overflow-hidden rounded-2xl bg-slate-200 mb-6">
                  <div className="absolute inset-0 bg-slate-300 group-hover:scale-105 transition-transform duration-700 ease-in-out">
                    <div className="w-full h-full flex items-center justify-center bg-[#E8E6E1]">
                      <div className="w-32 h-32 rounded-full bg-violet-400 mix-blend-multiply filter blur-2xl opacity-60"></div>
                      <div className="w-40 h-40 rounded-full bg-pink-400 mix-blend-multiply filter blur-2xl opacity-60 -ml-12"></div>
                    </div>
                  </div>
                  <div className="group-hover:bg-black/10 transition-colors duration-500 bg-black/0 absolute top-0 right-0 bottom-0 left-0"></div>
                </div>
                <div className="flex justify-between items-center border-t border-slate-300 pt-5 min-h-[5rem]">
                  <div>
                    <h3 className="md:text-4xl leading-none text-3xl text-slate-900 mb-1">
                      Private Parties
                    </h3>
                    <span className="text-lg text-slate-500">
                      Birthday, wedding, or celebration
                    </span>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0 ease-out">
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm text-xs font-bold uppercase tracking-widest text-slate-900 hover:bg-slate-900 hover:text-white transition-colors duration-300">
                      Try it
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M7 7h10v10"></path>
                        <path d="M7 17 17 7"></path>
                      </svg>
                    </span>
                  </div>
                </div>
              </article>

              {/* Feature 2: Close Friends */}
              <article className="group cursor-pointer md:mt-24">
                <div className="relative w-full aspect-[4/3] overflow-hidden rounded-2xl bg-slate-200 mb-6">
                  <div className="absolute inset-0 bg-slate-300 group-hover:scale-105 transition-transform duration-700 ease-in-out">
                    <div className="w-full h-full flex items-center justify-center bg-[#E8E6E1]">
                      <div className="w-32 h-32 rounded-full bg-blue-500 mix-blend-multiply filter blur-2xl opacity-60"></div>
                      <div className="w-40 h-40 rounded-full bg-cyan-500 mix-blend-multiply filter blur-2xl opacity-60 -ml-12"></div>
                    </div>
                  </div>
                  <div className="group-hover:bg-black/10 transition-colors duration-500 bg-black/0 absolute top-0 right-0 bottom-0 left-0"></div>
                </div>
                <div className="flex justify-between items-center border-t border-slate-300 pt-5 min-h-[5rem]">
                  <div>
                    <h3 className="md:text-4xl leading-none text-3xl text-slate-900 mb-1">
                      Close Friends
                    </h3>
                    <span className="text-lg text-slate-500">
                      Share without permanence anxiety
                    </span>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0 ease-out">
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm text-xs font-bold uppercase tracking-widest text-slate-900 hover:bg-slate-900 hover:text-white transition-colors duration-300">
                      Try it
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M7 7h10v10"></path>
                        <path d="M7 17 17 7"></path>
                      </svg>
                    </span>
                  </div>
                </div>
              </article>

              {/* Feature 3: Team Events */}
              <article className="group cursor-pointer">
                <div className="relative w-full aspect-[4/3] overflow-hidden rounded-2xl bg-slate-200 mb-6">
                  <div className="absolute inset-0 bg-slate-300 group-hover:scale-105 transition-transform duration-700 ease-in-out">
                    <div className="w-full h-full flex items-center justify-center bg-[#E8E6E1]">
                      <div className="w-32 h-32 rounded-full bg-emerald-400 mix-blend-multiply filter blur-2xl opacity-60"></div>
                      <div className="w-40 h-40 rounded-full bg-teal-400 mix-blend-multiply filter blur-2xl opacity-60 -ml-12"></div>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500"></div>
                </div>
                <div className="flex justify-between items-center border-t border-slate-300 pt-5 min-h-[5rem]">
                  <div>
                    <h3 className="md:text-4xl leading-none text-3xl text-slate-900 mb-1">
                      Team Events
                    </h3>
                    <span className="text-lg text-slate-500">
                      Company retreats, off-sites, celebrations
                    </span>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0 ease-out">
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm text-xs font-bold uppercase tracking-widest text-slate-900 hover:bg-slate-900 hover:text-white transition-colors duration-300">
                      Try it
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M7 7h10v10"></path>
                        <path d="M7 17 17 7"></path>
                      </svg>
                    </span>
                  </div>
                </div>
              </article>

              {/* Feature 4: Exclusive Events */}
              <article className="group cursor-pointer md:mt-24">
                <div className="relative w-full aspect-[4/3] overflow-hidden rounded-2xl bg-slate-200 mb-6">
                  <div className="absolute inset-0 bg-slate-300 group-hover:scale-105 transition-transform duration-700 ease-in-out">
                    <div className="w-full h-full flex items-center justify-center bg-[#E8E6E1]">
                      <div className="w-32 h-32 rounded-full bg-amber-400 mix-blend-multiply filter blur-2xl opacity-60"></div>
                      <div className="w-40 h-40 rounded-full bg-orange-400 mix-blend-multiply filter blur-2xl opacity-60 -ml-12"></div>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500"></div>
                </div>
                <div className="flex justify-between items-center border-t border-slate-300 pt-5 min-h-[5rem]">
                  <div>
                    <h3 className="md:text-4xl leading-none text-3xl text-slate-900 mb-1">
                      Exclusive Events
                    </h3>
                    <span className="text-lg text-slate-500">
                      Concerts, launches, private gatherings
                    </span>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0 ease-out">
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm text-xs font-bold uppercase tracking-widest text-slate-900 hover:bg-slate-900 hover:text-white transition-colors duration-300">
                      Try it
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M7 7h10v10"></path>
                        <path d="M7 17 17 7"></path>
                      </svg>
                    </span>
                  </div>
                </div>
              </article>
            </div>

            {/* How it Works Section */}
            <div id="how-it-works" className="mt-40 mb-20 scroll-mt-32">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
                {/* Left Side */}
                <div className="md:col-span-4 flex flex-col items-start">
                  <h2 className="md:text-5xl serif text-4xl italic text-slate-900 mb-8">
                    How It Works
                  </h2>
                  <button
                    onClick={handleCreateRoom}
                    className="inline-flex items-center gap-3 hover:bg-cyan-600 transition-all duration-300 hover:shadow-xl group text-lg font-medium text-white bg-slate-900 rounded-full pt-4 pr-8 pb-4 pl-8 shadow-lg"
                  >
                    Create Room
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="group-hover:translate-x-1 transition-transform"
                    >
                      <path d="M5 12h14"></path>
                      <path d="m12 5 7 7-7 7"></path>
                    </svg>
                  </button>
                </div>

                {/* Right Side: Steps */}
                <div className="md:col-span-8 flex flex-col">
                  {/* Step 1 */}
                  <div className="group py-8 border-b border-slate-300 cursor-pointer overflow-hidden transition-all duration-500">
                    <div className="flex items-center justify-between mb-2">
                      <span className="md:text-3xl text-2xl font-medium text-slate-400 group-hover:text-slate-900 transition-colors duration-300">
                        Create Your Room
                      </span>
                      <div className="w-10 h-10 flex items-center justify-center rounded-full border border-slate-300 group-hover:border-slate-900 group-hover:bg-slate-900 transition-all duration-300">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-stone-400 group-hover:text-white group-hover:rotate-90 transition-all duration-300"
                        >
                          <path d="M5 12h14"></path>
                          <path d="M12 5v14"></path>
                        </svg>
                      </div>
                    </div>
                    <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-all duration-500 ease-out">
                      <div className="overflow-hidden">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-100 max-w-2xl pt-4">
                          <p className="leading-relaxed text-lg font-light text-slate-600">
                            Set up your private room in seconds. Choose how long stories will last (1h, 3h, 6h, 12h, or 24h) and whether viewers can upload their own stories.
                          </p>
                          <div className="flex gap-3 mt-4 text-sm font-medium text-cyan-600 uppercase tracking-wide">
                            <span>• Upload Stories</span>
                            <span>• Set Duration</span>
                            <span>• Get Code</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="group py-8 border-b border-slate-300 cursor-pointer overflow-hidden transition-all duration-500">
                    <div className="flex items-center justify-between mb-2">
                      <span className="md:text-3xl text-2xl font-medium text-slate-400 group-hover:text-slate-900 transition-colors duration-300">
                        Share the Code
                      </span>
                      <div className="w-10 h-10 flex items-center justify-center rounded-full border border-slate-300 group-hover:border-slate-900 group-hover:bg-slate-900 transition-all duration-300">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-stone-400 group-hover:text-white group-hover:rotate-90 transition-all duration-300"
                        >
                          <path d="M5 12h14"></path>
                          <path d="M12 5v14"></path>
                        </svg>
                      </div>
                    </div>
                    <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-all duration-500 ease-out">
                      <div className="overflow-hidden">
                        <div className="pt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-100 max-w-2xl">
                          <p className="text-lg text-slate-600 leading-relaxed font-light">
                            Send your unique 6-character code to anyone you want in your room. Text it, share it in person, or post a QR code. No accounts needed to join.
                          </p>
                          <div className="flex gap-3 mt-4 text-sm font-medium text-cyan-600 uppercase tracking-wide">
                            <span>• Text Message</span>
                            <span>• QR Code</span>
                            <span>• Link Share</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="group cursor-pointer overflow-hidden transition-all duration-500 border-slate-300 border-b pt-8 pb-8">
                    <div className="flex items-center justify-between mb-2">
                      <span className="md:text-3xl text-2xl font-medium text-slate-400 group-hover:text-slate-900 transition-colors duration-300">
                        Watch It Vanish
                      </span>
                      <div className="w-10 h-10 flex items-center justify-center rounded-full border border-slate-300 group-hover:border-slate-900 group-hover:bg-slate-900 transition-all duration-300">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-stone-400 group-hover:text-white group-hover:rotate-90 transition-all duration-300"
                        >
                          <path d="M5 12h14"></path>
                          <path d="M12 5v14"></path>
                        </svg>
                      </div>
                    </div>
                    <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-all duration-500 ease-out">
                      <div className="overflow-hidden">
                        <div className="pt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-100 max-w-2xl">
                          <p className="leading-relaxed text-lg font-light text-slate-600">
                            When the time expires, everything disappears forever. No traces, no archives, no permanent records. Stories that are truly temporary.
                          </p>
                          <div className="flex gap-3 mt-4 text-sm font-medium text-cyan-600 uppercase tracking-wide">
                            <span>• Auto-Delete</span>
                            <span>• No Archives</span>
                            <span>• Complete Privacy</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Updated Footer Section */}
        <section id="contact" className="bg-[#Fdfcf8] pb-6 px-4 md:px-6 relative z-30">
          <div className="w-full max-w-[90rem] mx-auto bg-[#07201D] rounded-[2.5rem] md:rounded-[3.5rem] text-[#F0F7F6] py-20 px-6 md:px-20 relative overflow-hidden shadow-2xl flex flex-col items-center text-center">
            {/* Decorative Icon */}
            <div className="flex justify-center mb-8 opacity-10 text-cyan-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>

            {/* Main Quote */}
            <div className="max-w-5xl mx-auto mb-16">
              <h2 className="md:text-7xl leading-[1.1] text-4xl text-white tracking-tight font-instrument-serif mb-8">
                "The best moments are the ones you don't have to keep forever"
              </h2>
              <p className="md:text-sm uppercase text-xs font-medium text-cyan-400/50 tracking-[0.25em] font-manrope">
                — Zorem Philosophy
              </p>
            </div>

            {/* Divider */}
            <div className="w-full h-px bg-white/5 mb-16 max-w-6xl mx-auto"></div>

            {/* Bottom Content Stack */}
            <div className="flex flex-col gap-10 w-full items-center justify-center">
              {/* Main Navigation */}
              <nav className="flex flex-wrap justify-center gap-8 md:gap-16 text-cyan-100/80 uppercase tracking-[0.15em] text-xs font-bold font-manrope">
                <a href="#features" className="hover:text-white transition-colors">
                  Features
                </a>
                <a href="#use-cases" className="hover:text-white transition-colors">
                  Use Cases
                </a>
                <a href="#how-it-works" className="hover:text-white transition-colors">
                  How It Works
                </a>
                {isAuthenticated && (
                  <Link href="/my-rooms" className="hover:text-white transition-colors">
                    My Rooms
                  </Link>
                )}
              </nav>

              {/* Legal Links */}
              <nav className="flex flex-wrap justify-center gap-6 md:gap-8 text-cyan-400/30 uppercase tracking-[0.1em] text-[10px] font-medium font-manrope">
                <a href="#" className="hover:text-cyan-200/50 transition-colors">
                  Privacy Policy
                </a>
                <a href="#" className="hover:text-cyan-200/50 transition-colors">
                  Terms of Service
                </a>
                <a href="https://x.com/zoremstudios" className="hover:text-cyan-200/50 transition-colors">
                  Contact
                </a>
              </nav>

              {/* Brand & Copyright */}
              <div className="flex items-center gap-3 text-cyan-400/40 text-xs mt-4">
                <span className="font-instrument-serif italic text-2xl text-white opacity-90">
                  Zorem.
                </span>
                <span className="tracking-widest font-manrope text-[10px] mt-1">
                  © {new Date().getFullYear()}
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Mobile Menu */}
      <div
        className={`fixed inset-0 z-[60] bg-[#Fdfcf8] flex flex-col items-center justify-center transition-opacity duration-300 md:hidden ${
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <button
          onClick={() => setMobileMenuOpen(false)}
          className="absolute top-8 right-8 text-slate-900 p-2"
          aria-label="Close menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18"></path>
            <path d="m6 6 12 12"></path>
          </svg>
        </button>
        <nav className="flex flex-col items-center gap-8 text-3xl font-instrument-serif italic text-slate-900">
          <a href="#features" onClick={() => setMobileMenuOpen(false)} className="hover:text-cyan-600 transition-colors">
            Features
          </a>
          <a href="#use-cases" onClick={() => setMobileMenuOpen(false)} className="hover:text-cyan-600 transition-colors">
            Use Cases
          </a>
          <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="hover:text-cyan-600 transition-colors">
            How It Works
          </a>
          {isAuthenticated ? (
            <>
              <Link href="/my-rooms" className="hover:text-cyan-600 transition-colors">
                My Rooms
              </Link>
              <button
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                }}
                className="mt-4 px-8 py-3 border border-slate-900 rounded-full font-manrope not-italic text-lg hover:bg-slate-900 hover:text-white transition-all"
              >
                Log Out
              </button>
            </>
          ) : (
            <Link
              href="/auth"
              className="mt-4 px-8 py-3 border border-slate-900 rounded-full font-manrope not-italic text-lg hover:bg-slate-900 hover:text-white transition-all"
            >
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </div>
  );
}
