/**
 * MyRoomsPage - Protected page showing user's rooms
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context';
import { roomsAPI } from '@/lib';
import { Button, Card, CardContent } from '@/components/ui';
import { ArrowLeft, Plus, Trash2, Clock, Users } from 'lucide-react';
import type { Room } from '@/types';

export function MyRoomsPage() {
    const { user, logout } = useAuth();
    const [rooms, setRooms] = useState<Room[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadRooms();
    }, []);

    async function loadRooms() {
        try {
            const result = await roomsAPI.list();
            setRooms(result.rooms || []);
        } catch (err) {
            setError((err as Error).message || 'Failed to load rooms');
        } finally {
            setIsLoading(false);
        }
    }

    async function handleCloseRoom(roomId: string) {
        if (!confirm('Are you sure you want to close this room? All stories will be deleted.')) {
            return;
        }

        try {
            await roomsAPI.close(roomId);
            setRooms(rooms.filter((r) => r.id !== roomId));
        } catch (err) {
            setError((err as Error).message || 'Failed to close room');
        }
    }

    function formatTimeRemaining(expiresAt: string): string {
        const now = new Date();
        const expires = new Date(expiresAt);
        const diff = expires.getTime() - now.getTime();

        if (diff <= 0) return 'Expired';

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h left`;
        return `${hours}h left`;
    }

    return (
        <div className="min-h-screen bg-background p-4">
            {/* Background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[80%] h-[600px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-violet-900/20 via-background to-background blur-[100px] opacity-50" />
            </div>

            {/* Navigation */}
            <nav className="relative z-10 max-w-7xl mx-auto mb-8 flex items-center justify-between">
                <Link to="/" className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                    <span>Back</span>
                </Link>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-neutral-500 max-w-[220px] truncate" title={user?.email}>
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
            <main className="relative z-10 max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8 animate-fade-up">
                    <div>
                        <h1 className="text-3xl font-medium text-white">My Rooms</h1>
                        <p className="text-neutral-400">Manage your private story rooms</p>
                    </div>
                    <Link to="/create-room">
                        <Button size="sm">
                            <Plus className="w-4 h-4" />
                            New Room
                        </Button>
                    </Link>
                </div>

                {isLoading ? (
                    <Card>
                        <CardContent className="text-center py-8 text-neutral-400">
                            Loading rooms...
                        </CardContent>
                    </Card>
                ) : error ? (
                    <Card>
                        <CardContent className="text-center py-8 text-red-400">
                            {error}
                        </CardContent>
                    </Card>
                ) : rooms.length === 0 ? (
                    <Card>
                        <CardContent className="text-center py-12">
                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                                <Plus className="w-8 h-8 text-neutral-500" />
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">No rooms yet</h3>
                            <p className="text-neutral-400 mb-6">Create your first room to start sharing stories</p>
                            <Link to="/create-room">
                                <Button>Create Room</Button>
                            </Link>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {rooms.map((room) => (
                            <Card key={room.id} className="animate-fade-up">
                                <CardContent className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="text-2xl font-mono font-bold text-white">{room.code}</div>
                                        <div className="flex items-center gap-4 text-sm text-neutral-400">
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-4 h-4" />
                                                {formatTimeRemaining(room.expires_at)}
                                            </span>
                                            {room.allow_uploads && (
                                                <span className="flex items-center gap-1">
                                                    <Users className="w-4 h-4" />
                                                    Uploads allowed
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Link to={`/room?room_id=${room.id}`}>
                                            <Button variant="outline" size="sm">View</Button>
                                        </Link>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleCloseRoom(room.id)}
                                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
