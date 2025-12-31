'use client';

/**
 * LandingPage - Full landing page with hero, features, animations, etc.
 */

import { useState, useEffect, useRef, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/context';
import { api } from '@/lib';

export default function LandingPage() {
    const { isAuthenticated, user, logout } = useAuth();
    const router = useRouter();
    const [roomCode, setRoomCode] = useState('');
    const [isValidating, setIsValidating] = useState(false);
    const [error, setError] = useState('');

    // Card shine effect refs
    const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

    // Handle card shine effect
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            cardRefs.current.forEach((card) => {
                if (!card) return;
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                card.style.setProperty('--mouse-x', `${x}px`);
                card.style.setProperty('--mouse-y', `${y}px`);
            });
        };

        document.addEventListener('mousemove', handleMouseMove);
        return () => document.removeEventListener('mousemove', handleMouseMove);
    }, []);

    const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        setRoomCode(value);
        setError('');
    };

    const handleJoinRoom = async (e?: FormEvent) => {
        e?.preventDefault();
        
        if (!roomCode || roomCode.length !== 6) {
            setError('Please enter a valid 6-character code');
            return;
        }

        setIsValidating(true);
        setError('');

        try {
            const result = await api.rooms.validateCode(roomCode);
            if (result.valid) {
                router.push(`/nickname?code=${roomCode}`);
            } else {
                setError(result.error || 'Invalid room code');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to validate code');
        } finally {
            setIsValidating(false);
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
        <div className="min-h-screen bg-[#050505] antialiased selection:bg-white/20 selection:text-white overflow-x-hidden text-neutral-300">
            
            {/* Background Ambience */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[80%] h-[600px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-violet-900/20 via-[#050505] to-[#050505] blur-[100px] opacity-50" />
                <div className="bg-grid absolute inset-0 opacity-60" />
            </div>

            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-[#050505]/80 backdrop-blur-xl transition-all duration-300 border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                        <Image src="/logo.png" alt="Zorem" width={32} height={32} className="object-contain logo-spin" />
                    </div>

                    <div className="hidden md:flex items-center gap-8 text-[13px] font-medium text-neutral-400">
                        <a href="#features" className="transition-colors hover:text-white">Features</a>
                        <a href="#how-it-works" className="transition-colors hover:text-white">How it works</a>
                        <a href="#privacy" className="transition-colors hover:text-white">Privacy</a>
                    </div>

                    <div className="flex items-center gap-3">
                        {isAuthenticated ? (
                            <>
                                <span className="text-[13px] font-medium text-neutral-500 max-w-[180px] truncate hidden sm:block" title={user?.email}>
                                    {user?.email}
                                </span>
                                <button
                                    onClick={() => router.push('/my-rooms')}
                                    className="text-[13px] font-medium transition-colors px-2 text-neutral-400 hover:text-white"
                                >
                                    My Rooms
                                </button>
                                <button
                                    onClick={logout}
                                    className="text-[13px] font-medium transition-colors px-2 text-neutral-400 hover:text-white"
                                >
                                    Log out
                                </button>
                            </>
                        ) : (
                            <>
                                <Link href="/auth" className="text-[13px] font-medium transition-colors px-2 hidden sm:block text-neutral-400 hover:text-white">
                                    Sign in
                                </Link>
                                <Link href="/auth?mode=signup" className="text-[13px] font-medium transition-colors px-2 hidden sm:block text-neutral-400 hover:text-white">
                                    Register
                                </Link>
                            </>
                        )}
                        <button
                            onClick={handleCreateRoom}
                            className="group relative px-4 py-1.5 rounded-full text-[13px] font-medium transition-all overflow-hidden bg-white text-black hover:bg-neutral-200"
                        >
                            <span className="relative z-10 flex items-center gap-1">Create Room</span>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:animate-[beam_1s_infinite]" />
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <main className="flex flex-col text-center max-w-[90rem] z-10 mr-auto ml-auto pt-24 pr-4 pb-20 pl-4 relative items-center">
                
                {/* Status Badge */}
                <div className="animate-fade-up delay-100 mb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border backdrop-blur-md shadow-[0_0_15px_-3px_rgba(255,255,255,0.1)] border-white/10 bg-white/5">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        <span className="text-[11px] font-medium tracking-wide uppercase text-neutral-300">Stories disappear. The spark stays.</span>
                    </div>
                </div>

                {/* Main Heading */}
                <h1 className="animate-fade-up delay-200 text-5xl md:text-7xl lg:text-8xl font-medium tracking-tighter leading-[0.95] mb-8 text-white">
                    Private Stories for<br />
                    <span className="font-serif italic opacity-80 font-light pr-2 text-neutral-400">informal partners.</span>
                </h1>

                <p className="animate-fade-up delay-300 text-base md:text-lg max-w-xl mx-auto leading-relaxed mb-10 font-light text-neutral-400">
                    Share ephemeral stories with a select few. No followers, no ads, no algorithm. Just your story.
                </p>

                {/* Join Room - Code Input (Primary CTA) */}
                <div className="animate-fade-up delay-500 relative w-full max-w-2xl mx-auto mb-8">
                    <div className="glass rounded-2xl p-6 md:p-8">
                        <form onSubmit={handleJoinRoom} className="flex flex-col md:flex-row gap-4 items-center">
                            <div className="flex-1 w-full">
                                <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2 block text-left">Enter Room Code</label>
                                <input 
                                    type="text" 
                                    value={roomCode}
                                    onChange={handleCodeChange}
                                    placeholder="XXXXXX" 
                                    maxLength={6}
                                    className="w-full h-14 px-6 rounded-xl glass-input text-2xl font-mono text-center text-white placeholder:text-neutral-600 code-input outline-none transition-all uppercase"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isValidating}
                                className="group relative h-14 px-8 rounded-xl font-medium text-sm transition-all overflow-hidden flex items-center gap-2 bg-white text-black hover:bg-neutral-200 w-full md:w-auto justify-center mt-2 md:mt-6 disabled:opacity-50"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
                                <span className="relative z-10">{isValidating ? 'Validating...' : 'Join Room'}</span>
                            </button>
                        </form>
                        
                        {error && (
                            <p className="text-red-400 text-sm mt-4">{error}</p>
                        )}
                        
                        <div className="mt-6 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-center gap-4">
                            <span className="text-xs text-neutral-500">or start sharing your own stories</span>
                            <button
                                onClick={handleCreateRoom}
                                className="group relative h-10 px-6 rounded-full font-medium text-xs transition-all overflow-hidden flex items-center gap-2 border border-white/10 text-neutral-300 hover:text-white hover:bg-white/5"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                                <span>Create Room</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Visual Element - Floating Story Cards */}
                <div className="animate-fade-up delay-500 relative w-full max-w-3xl mx-auto mb-24">
                    <div className="relative h-48 flex items-center justify-center">
                        {/* Left floating card */}
                        <div className="absolute -left-4 md:left-12 top-4 w-20 h-32 md:w-24 md:h-40 rounded-xl border bg-[#0F0F11]/80 backdrop-blur-md animate-float border-white/10 overflow-hidden" style={{ animationDelay: '0.5s' }}>
                            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-pink-500/20" />
                            <div className="absolute bottom-2 left-2 right-2">
                                <div className="h-1 w-8 bg-white/30 rounded-full mb-1" />
                                <div className="h-1 w-5 bg-white/20 rounded-full" />
                            </div>
                        </div>
                        
                        {/* Center main card */}
                        <div className="relative w-28 h-44 md:w-32 md:h-52 rounded-2xl border bg-[#0F0F11] backdrop-blur-md animate-float border-white/10 overflow-hidden z-10 shadow-2xl" style={{ animationDelay: '1s' }}>
                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
                            <div className="absolute top-3 left-3 right-3 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-400 to-pink-400" />
                                <div className="h-1.5 w-12 bg-white/30 rounded-full" />
                            </div>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                <svg className="w-8 h-8 text-white/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                            </div>
                            <div className="absolute bottom-3 left-3 right-3">
                                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full w-2/3 bg-white/40 rounded-full" />
                                </div>
                            </div>
                        </div>
                        
                        {/* Right floating card */}
                        <div className="absolute -right-4 md:right-12 top-8 w-20 h-32 md:w-24 md:h-40 rounded-xl border bg-[#0F0F11]/80 backdrop-blur-md animate-float border-white/10 overflow-hidden" style={{ animationDelay: '1.5s' }}>
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-cyan-500/20" />
                            <div className="absolute bottom-2 left-2 right-2">
                                <div className="h-1 w-6 bg-white/30 rounded-full mb-1" />
                                <div className="h-1 w-10 bg-white/20 rounded-full" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Trust indicators */}
                <div className="w-full max-w-4xl mx-auto overflow-hidden opacity-40 hover:opacity-80 transition-opacity duration-500">
                    <div className="flex items-center justify-center gap-8 md:gap-16 flex-wrap">
                        <div className="flex items-center gap-2 text-neutral-600">
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                            <span className="text-sm font-medium">End-to-end encrypted</span>
                        </div>
                        <div className="flex items-center gap-2 text-neutral-600">
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                            <span className="text-sm font-medium">Auto-destruct</span>
                        </div>
                        <div className="flex items-center gap-2 text-neutral-600">
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
                            <span className="text-sm font-medium">No followers</span>
                        </div>
                    </div>
                </div>
            </main>

            {/* Features Section */}
            <section id="features" className="py-20 px-6 max-w-7xl mx-auto relative">
                <div className="mb-16">
                    <h2 className="text-3xl md:text-4xl font-medium tracking-tight mb-4 text-white">
                        Built for moments that <span className="font-serif italic opacity-80">matter.</span>
                    </h2>
                    <p className="text-sm md:text-base text-neutral-400">Not another social network. A private space for sharing stories with the people you choose.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div
                        ref={(el) => { cardRefs.current[0] = el; }}
                        className="glass rounded-3xl p-8 relative overflow-hidden group card-shine"
                    >
                        <div className="w-10 h-10 rounded-lg border flex items-center justify-center mb-6 bg-white/5 border-white/10 text-white">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                        </div>
                        <h3 className="text-lg font-medium mb-2 text-white">Ephemeral by Design</h3>
                        <p className="text-sm leading-relaxed text-neutral-400">Stories auto-destruct after the time you set. Share freely.</p>
                    </div>

                    <div
                        ref={(el) => { cardRefs.current[1] = el; }}
                        className="glass rounded-3xl p-8 relative overflow-hidden group card-shine"
                    >
                        <div className="w-10 h-10 rounded-lg border flex items-center justify-center mb-6 bg-white/5 border-white/10 text-white">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 7h.01M7 12h.01M7 17h.01M12 7h.01M12 12h.01M12 17h.01M17 7h.01M17 12h.01M17 17h.01" /></svg>
                        </div>
                        <h3 className="text-lg font-medium mb-2 text-white">Access by Code</h3>
                        <p className="text-sm leading-relaxed text-neutral-400">Share a 6-digit code and your audience is in. No accounts, no friction.</p>
                    </div>

                    <div
                        ref={(el) => { cardRefs.current[2] = el; }}
                        className="glass rounded-3xl p-8 relative overflow-hidden group card-shine"
                    >
                        <div className="w-10 h-10 rounded-lg border flex items-center justify-center mb-6 bg-white/5 border-white/10 text-white">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>
                        </div>
                        <h3 className="text-lg font-medium mb-2 text-white">Not a Social Network</h3>
                        <p className="text-sm leading-relaxed text-neutral-400">No followers. No feed. No algorithm. Just you and your story.</p>
                    </div>
                </div>
            </section>

            {/* How it Works Section */}
            <section id="how-it-works" className="py-32 relative overflow-hidden border-t border-white/5">
                <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col items-center text-center">
                    <h2 className="text-3xl md:text-5xl font-medium tracking-tight mb-8 text-white">
                        Simple. Private. <span className="text-neutral-500">Ephemeral.</span>
                    </h2>
                    
                    <div className="w-full max-w-4xl mt-16">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="text-center">
                                <div className="w-16 h-16 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center mx-auto mb-6">
                                    <span className="text-2xl font-serif italic text-white">1</span>
                                </div>
                                <h3 className="text-lg font-medium text-white mb-2">Create a Room</h3>
                                <p className="text-sm text-neutral-500">Upload your stories and set how long they&apos;ll last.</p>
                            </div>
                            <div className="text-center">
                                <div className="w-16 h-16 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center mx-auto mb-6">
                                    <span className="text-2xl font-serif italic text-white">2</span>
                                </div>
                                <h3 className="text-lg font-medium text-white mb-2">Share the Code</h3>
                                <p className="text-sm text-neutral-500">Send the code to whoever you want.</p>
                            </div>
                            <div className="text-center">
                                <div className="w-16 h-16 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center mx-auto mb-6">
                                    <span className="text-2xl font-serif italic text-white">3</span>
                                </div>
                                <h3 className="text-lg font-medium text-white mb-2">Watch it Vanish</h3>
                                <p className="text-sm text-neutral-500">When time expires, everything disappears forever.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative pt-32 pb-12 bg-[#050505] overflow-hidden border-t border-white/5">
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="flex flex-col items-center text-center mb-24">
                        <h2 className="text-4xl md:text-6xl font-medium tracking-tight mb-8 text-white">
                            Ready to share <span className="font-serif italic opacity-80">privately?</span>
                        </h2>
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            <button
                                onClick={handleCreateRoom}
                                className="group relative h-12 px-8 rounded-full font-medium text-sm transition-all overflow-hidden flex items-center gap-2 bg-white text-black hover:bg-neutral-200"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                                <span className="relative z-10">Create Your First Room</span>
                            </button>
                        </div>
                    </div>

                    <div className="border-t pt-12 flex flex-col md:flex-row justify-between gap-8 border-white/5">
                        <div className="flex items-center gap-2">
                            <Image src="/logo.png" alt="Zorem" width={20} height={20} className="object-contain opacity-60" />
                            <span className="text-xs text-neutral-600">© {new Date().getFullYear()} Zorem.</span>
                        </div>
                        
                        <div className="flex gap-8 text-xs text-neutral-500 font-medium">
                            <a href="#" className="transition-colors hover:text-white">Privacy</a>
                            <a href="#" className="transition-colors hover:text-white">Terms</a>
                            <a href="https://x.com/zoremstudios" className="transition-colors hover:text-white">Contact</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
