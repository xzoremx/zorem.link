'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context';
import { roomsAPI, storage } from '@/lib';
import { Button } from '@/components';
import type { RoomListItem } from '@/types';

export default function MyRoomsPage() {
    const router = useRouter();
    const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth();
    
    const [rooms, setRooms] = useState<RoomListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [closingRoomId, setClosingRoomId] = useState<string | null>(null);

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
        setIsLoading(true);
        setError('');
        try {
            const result = await roomsAPI.list();
            setRooms(result.rooms || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load rooms');
        } finally {
            setIsLoading(false);
        }
    };

    const formatDate = (iso: string) => {
        try {
            const d = new Date(iso);
            return d.toLocaleString(undefined, { 
                year: 'numeric', 
                month: 'short', 
                day: '2-digit', 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        } catch {
            return iso;
        }
    };

    const getStatus = (room: RoomListItem) => {
        const now = Date.now();
        const expiresAt = new Date(room.expires_at).getTime();
        const expired = Number.isFinite(expiresAt) ? expiresAt <= now : false;

        if (!room.is_active) return 'CLOSED';
        if (expired) return 'EXPIRED';
        return 'ACTIVE';
    };

    const getExpiresLabel = (room: RoomListItem, status: string) => {
        if (status === 'ACTIVE') {
            return room.hours_remaining > 0 
                ? `Expires in ~${room.hours_remaining}h` 
                : 'Expiring soon';
        }
        if (status === 'EXPIRED') {
            return `Expired: ${formatDate(room.expires_at)}`;
        }
        return `Closed: ${formatDate(room.expires_at)}`;
    };

    const buildInviteLink = (code: string) => {
        if (typeof window !== 'undefined') {
            return `${window.location.origin}/nickname?code=${encodeURIComponent(code)}`;
        }
        return `/nickname?code=${encodeURIComponent(code)}`;
    };

    const copyToClipboard = async (text: string, id: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 1500);
        } catch {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 1500);
        }
    };

    const openRoom = (room: RoomListItem) => {
        // Store room ID and code, then navigate to room
        storage.setRoomId(room.room_id);
        storage.setRoomCode(room.code);
        router.push('/room');
    };

    const closeRoom = async (room: RoomListItem) => {
        if (!confirm(`Close room ${room.code}? This will end the room immediately and cannot be undone.`)) {
            return;
        }

        setClosingRoomId(room.room_id);
        try {
            await roomsAPI.close(room.room_id);
            // Update local state
            setRooms(prev => prev.map(r =>
                r.room_id === room.room_id
                    ? { ...r, is_active: false }
                    : r
            ));
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to close room');
        } finally {
            setClosingRoomId(null);
        }
    };

    // Separate active and past rooms (using is_expired from API)
    const activeRooms = rooms.filter(r => r.is_active && !r.is_expired);
    const pastRooms = rooms.filter(r => !r.is_active || r.is_expired);

    if (authLoading || (!isAuthenticated && !authLoading)) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <div className="text-neutral-400">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] p-4">
            {/* Background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[80%] h-[600px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-violet-900/20 via-[#050505] to-[#050505] blur-[100px] opacity-50" />
            </div>

            {/* Navigation */}
            <nav className="relative z-10 max-w-5xl mx-auto mb-8 flex items-center justify-between">
                <Link href="/" className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                    <span>Home</span>
                </Link>
                <div className="flex items-center gap-3">
                    <Link href="/create-room" className="text-sm text-neutral-400 hover:text-white transition-colors">
                        Create Room
                    </Link>
                    <span className="text-sm text-neutral-500 max-w-[220px] truncate hidden sm:block" title={user?.email}>
                        {user?.email}
                    </span>
                    <button 
                        onClick={logout} 
                        className="text-sm text-neutral-400 hover:text-white transition-colors"
                    >
                        Log out
                    </button>
                </div>
            </nav>

            {/* Main Content */}
            <main className="relative z-10 max-w-5xl mx-auto">
                <div className="text-center mb-8 animate-[fadeUp_0.8s_ease-out_forwards]">
                    <h1 className="text-4xl md:text-5xl font-medium tracking-tight mb-3 text-white">My Rooms</h1>
                    <p className="text-neutral-400">Your active rooms and recent history</p>
                </div>

                {/* Loading */}
                {isLoading && (
                    <div className="glass rounded-2xl p-8 text-center">
                        <div className="text-neutral-400">Loading your rooms...</div>
                        <div className="text-xs text-neutral-600 mt-2">
                            If you're on Render free tier, the API may take ~30–60s to wake up.
                        </div>
                    </div>
                )}

                {/* Error */}
                {error && !isLoading && (
                    <div className="glass rounded-2xl p-8 text-center">
                        <div className="text-red-400 font-medium mb-2">Couldn't load your rooms</div>
                        <div className="text-neutral-400 text-sm mb-6">{error}</div>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Button onClick={loadRooms}>Retry</Button>
                            <Link href="/create-room">
                                <Button variant="outline">Create a room</Button>
                            </Link>
                        </div>
                    </div>
                )}

                {/* Content */}
                {!isLoading && !error && (
                    <div className="space-y-6">
                        {/* Active Rooms */}
                        <div className="glass rounded-2xl p-6 md:p-8">
                            <div className="flex items-center justify-between gap-4 mb-6">
                                <div>
                                    <h2 className="text-lg font-medium text-white">Active</h2>
                                    <p className="text-sm text-neutral-500">Rooms that are still live</p>
                                </div>
                                <span className="text-xs text-neutral-500">
                                    {activeRooms.length} room{activeRooms.length !== 1 ? 's' : ''}
                                </span>
                            </div>

                            {activeRooms.length === 0 ? (
                                <div className="text-center text-neutral-500 text-sm py-8">
                                    No active rooms yet.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {activeRooms.map((room) => {
                                        const status = getStatus(room);
                                        return (
                                            <div key={room.room_id} className="glass rounded-2xl p-5">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-medium tracking-wider text-emerald-400">
                                                                {status}
                                                            </span>
                                                            <span className="text-xs text-neutral-600">•</span>
                                                            <span className="text-xs text-neutral-500">
                                                                {getExpiresLabel(room, status)}
                                                            </span>
                                                        </div>
                                                        <div className="mt-2 text-3xl font-mono font-bold text-white">
                                                            {room.code}
                                                        </div>
                                                        <div className="mt-2 text-xs text-neutral-500">
                                                            Created: {formatDate(room.created_at)} • 
                                                            Uploads: {room.allow_uploads ? 'on' : 'off'} • 
                                                            Stories: {room.story_count} • 
                                                            Viewers: {room.viewer_count}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => openRoom(room)}
                                                        className="shrink-0 h-10 px-4 rounded-xl bg-white text-black hover:bg-neutral-200 font-medium"
                                                    >
                                                        Open
                                                    </button>
                                                </div>

                                                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                                                    <button
                                                        onClick={() => copyToClipboard(room.code, `code-${room.room_id}`)}
                                                        className="h-10 px-4 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-medium text-white"
                                                    >
                                                        {copiedId === `code-${room.room_id}` ? 'Copied!' : 'Copy code'}
                                                    </button>
                                                    <button
                                                        onClick={() => copyToClipboard(buildInviteLink(room.code), `link-${room.room_id}`)}
                                                        className="h-10 px-4 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-medium text-white"
                                                    >
                                                        {copiedId === `link-${room.room_id}` ? 'Copied!' : 'Copy invite link'}
                                                    </button>
                                                    <button
                                                        onClick={() => closeRoom(room)}
                                                        disabled={closingRoomId === room.room_id}
                                                        className="h-10 px-4 rounded-xl border border-red-500/30 hover:bg-red-500/10 text-sm font-medium text-red-400 disabled:opacity-50"
                                                    >
                                                        {closingRoomId === room.room_id ? 'Closing...' : 'Close'}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Past Rooms */}
                        <div className="glass rounded-2xl p-6 md:p-8">
                            <div className="flex items-center justify-between gap-4 mb-4">
                                <div>
                                    <h2 className="text-lg font-medium text-white">Past</h2>
                                    <p className="text-sm text-neutral-500">Expired or closed rooms</p>
                                </div>
                                <span className="text-xs text-neutral-500">
                                    {pastRooms.length} room{pastRooms.length !== 1 ? 's' : ''}
                                </span>
                            </div>

                            {pastRooms.length > 0 && (
                                <div className="mb-6 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                    <p className="text-xs text-amber-400/80">
                                        Media deleted. Stats available for 7 days.
                                    </p>
                                </div>
                            )}

                            {pastRooms.length === 0 ? (
                                <div className="text-center text-neutral-500 text-sm py-8">
                                    No past rooms.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {pastRooms.map((room) => {
                                        const status = getStatus(room);
                                        return (
                                            <div key={room.room_id} className="glass rounded-2xl p-5 opacity-60">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-xs font-medium tracking-wider ${
                                                                status === 'EXPIRED' ? 'text-amber-400' : 'text-red-400'
                                                            }`}>
                                                                {status}
                                                            </span>
                                                            <span className="text-xs text-neutral-600">•</span>
                                                            <span className="text-xs text-neutral-500">
                                                                {getExpiresLabel(room, status)}
                                                            </span>
                                                        </div>
                                                        <div className="mt-2 text-3xl font-mono font-bold text-white">
                                                            {room.code}
                                                        </div>
                                                        <div className="mt-2 text-xs text-neutral-500">
                                                            Created: {formatDate(room.created_at)}
                                                        </div>
                                                        <div className="mt-1 text-xs text-neutral-500">
                                                            Stories: {room.story_count} •
                                                            Viewers: {room.viewer_count} •
                                                            Views: {room.total_views} •
                                                            Likes: {room.total_likes}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
