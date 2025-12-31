/**
 * NicknamePage - Entry point for viewers joining a room
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { viewerAPI, storage, roomsAPI } from '@/lib';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { sanitizeHtml } from '@/lib/sanitize';

export function NicknamePage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [roomCode, setRoomCode] = useState('');
    const [nickname, setNickname] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [roomValid, setRoomValid] = useState(false);

    // Get code from URL if present
    useEffect(() => {
        const code = searchParams.get('code');
        if (code) {
            setRoomCode(code.toUpperCase());
            validateRoom(code);
        }
    }, [searchParams]);

    async function validateRoom(code: string) {
        try {
            await roomsAPI.validateCode(code);
            setRoomValid(true);
            setError('');
        } catch (err) {
            setRoomValid(false);
            setError((err as Error).message || 'Invalid room code');
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');

        // Sanitize nickname
        const cleanNickname = sanitizeHtml(nickname.trim());

        if (!cleanNickname) {
            setError('Please enter a nickname');
            return;
        }

        if (cleanNickname.length > 20) {
            setError('Nickname must be 20 characters or less');
            return;
        }

        setIsLoading(true);

        try {
            const result = await viewerAPI.join(roomCode, cleanNickname);
            storage.setViewerHash(result.viewer_hash);
            storage.setRoomId(result.room.id);
            navigate(`/room?room_id=${result.room.id}`);
        } catch (err) {
            setError((err as Error).message || 'Failed to join room');
        } finally {
            setIsLoading(false);
        }
    }

    function handleCodeChange(value: string) {
        const code = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
        setRoomCode(code);

        if (code.length === 6) {
            validateRoom(code);
        } else {
            setRoomValid(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            {/* Background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[80%] h-[600px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-violet-900/20 via-background to-background blur-[100px] opacity-50" />
            </div>

            <div className="relative z-10 w-full max-w-md animate-fade-up">
                {/* Logo */}
                <div className="flex items-center justify-center mb-8">
                    <img src="/logo.png" alt="Zorem" className="w-12 h-12 object-contain" />
                </div>

                <Card>
                    <CardHeader className="text-center">
                        <CardTitle>Join a Room</CardTitle>
                        <CardDescription>Enter the room code and pick a nickname</CardDescription>
                    </CardHeader>

                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                type="text"
                                label="Room Code"
                                placeholder="XXXXXX"
                                value={roomCode}
                                onChange={(e) => handleCodeChange(e.target.value)}
                                className="text-center font-mono text-2xl tracking-widest !uppercase"
                                maxLength={6}
                                required
                            />

                            {roomValid && (
                                <div className="text-center text-green-400 text-sm">
                                    ✓ Room found! Enter your nickname to join.
                                </div>
                            )}

                            <Input
                                type="text"
                                label="Your Nickname"
                                placeholder="How should we call you?"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                maxLength={20}
                                disabled={!roomValid}
                                required
                            />

                            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={!roomValid || !nickname || isLoading}
                            >
                                {isLoading ? 'Joining...' : 'Join Room'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
