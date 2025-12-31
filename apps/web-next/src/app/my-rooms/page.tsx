'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context';
import { roomsAPI } from '@/lib';
import { Button } from '@/components';
import type { Room } from '@/types';

export default function MyRoomsPage() {
    const router = useRouter();
    const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth();
    
    const [rooms, setRooms] = useState<Room[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/auth');
            return;
        }

        if (isAuthenticated) {
            loadRooms();
        }
    }, [authLoading, isAuthenticated, router]);

    const loadRooms = async () => {
        try {
            const result = await roomsAPI.list();
            setRooms(result.rooms || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load rooms');
        } finally {
            setIsLoading(false);
        }
    };

    const formatExpiry = (expiresAt: string) => {
        const expiry = new Date(expiresAt);
        const now = new Date();
        const diff = expiry.getTime() - now.getTime();
        
        if (diff < 0) return 'Expired';
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) return `${hours}h ${minutes}m left`;
        return `${minutes}m left`;
    };

    if (authLoading || (!isAuthenticated && !authLoading)) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <div className="text-neutral-400">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505]">
            {/* Background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[80%] h-[600px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-violet-900/20 via-[#050505] to-[#050505] blur-[100px] opacity-50" />
            </div>

            {/* Header */}
            <header className="relative z-10 border-b border-white/5 bg-[#050505]/80 backdrop-blur-xl">
                <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <Image src="/logo.png" alt="Zorem" width={32} height={32} className="logo-spin" />
                    </Link>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-neutral-500 hidden sm:block">{user?.email}</span>
                        <button onClick={logout} className="text-sm text-neutral-400 hover:text-white transition-colors">
                            Log out
                        </button>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="relative z-10 max-w-4xl mx-auto px-6 py-12">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-medium text-white">My Rooms</h1>
                    <Link href="/create-room">
                        <Button size="sm">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Create Room
                        </Button>
                    </Link>
                </div>

                {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

                {isLoading ? (
                    <div className="text-center py-12 text-neutral-400">Loading rooms...</div>
                ) : rooms.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <path d="M12 8v8M8 12h8" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-medium text-white mb-2">No rooms yet</h2>
                        <p className="text-neutral-400 text-sm mb-6">Create your first room to start sharing stories</p>
                        <Link href="/create-room">
                            <Button>Create Your First Room</Button>
                        </Link>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {rooms.map((room) => (
                            <div key={room.id} className="glass rounded-xl p-6 flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-2xl font-mono text-white">{room.code}</span>
                                        <span className={`text-xs px-2 py-1 rounded-full ${
                                            new Date(room.expires_at) > new Date() 
                                                ? 'bg-emerald-500/20 text-emerald-400'
                                                : 'bg-red-500/20 text-red-400'
                                        }`}>
                                            {formatExpiry(room.expires_at)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-neutral-500">
                                        Created {new Date(room.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(room.code)}>
                                        Copy Code
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
