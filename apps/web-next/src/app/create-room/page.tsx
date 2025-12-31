'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context';
import { roomsAPI } from '@/lib';
import { Button } from '@/components';

const DURATION_OPTIONS = [
    { value: '1h', label: '1 Hour' },
    { value: '6h', label: '6 Hours' },
    { value: '12h', label: '12 Hours' },
    { value: '24h', label: '24 Hours' },
];

export default function CreateRoomPage() {
    const router = useRouter();
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    
    const [duration, setDuration] = useState('24h');
    const [allowUploads, setAllowUploads] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState('');

    // Redirect if not authenticated
    if (!authLoading && !isAuthenticated) {
        router.push('/auth');
        return null;
    }

    const handleCreate = async () => {
        setIsCreating(true);
        setError('');

        try {
            const result = await roomsAPI.create(duration, allowUploads);
            // Redirect to room management or show QR code
            router.push(`/my-rooms?created=${result.code}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create room');
        } finally {
            setIsCreating(false);
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <div className="text-neutral-400">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
            {/* Background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[80%] h-[600px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-violet-900/20 via-[#050505] to-[#050505] blur-[100px] opacity-50" />
            </div>

            <div className="relative z-10 w-full max-w-md">
                {/* Logo */}
                <div className="flex justify-center mb-8">
                    <Link href="/">
                        <Image src="/logo.png" alt="Zorem" width={48} height={48} className="logo-spin" />
                    </Link>
                </div>

                {/* Card */}
                <div className="glass rounded-2xl p-8">
                    <h1 className="text-2xl font-medium text-white text-center mb-2">Create a Room</h1>
                    <p className="text-neutral-400 text-sm text-center mb-8">
                        Set up your private story room
                    </p>

                    <div className="space-y-6">
                        {/* Duration */}
                        <div>
                            <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3 block">
                                Room Duration
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {DURATION_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setDuration(opt.value)}
                                        className={`py-3 rounded-xl text-sm font-medium transition-all ${
                                            duration === opt.value
                                                ? 'bg-white text-black'
                                                : 'bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white border border-white/10'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Allow Uploads */}
                        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                            <div>
                                <div className="text-sm font-medium text-white">Allow viewer uploads</div>
                                <div className="text-xs text-neutral-500">Viewers can add stories to this room</div>
                            </div>
                            <button
                                onClick={() => setAllowUploads(!allowUploads)}
                                className={`w-12 h-6 rounded-full transition-all ${
                                    allowUploads ? 'bg-violet-500' : 'bg-white/10'
                                }`}
                            >
                                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                                    allowUploads ? 'translate-x-6' : 'translate-x-0.5'
                                }`} />
                            </button>
                        </div>

                        {error && <p className="text-red-400 text-sm">{error}</p>}

                        <Button onClick={handleCreate} disabled={isCreating} className="w-full">
                            {isCreating ? 'Creating...' : 'Create Room'}
                        </Button>
                    </div>
                </div>

                <p className="text-center text-neutral-500 text-xs mt-6">
                    <Link href="/my-rooms" className="hover:text-white transition-colors">← Back to My Rooms</Link>
                </p>
            </div>
        </div>
    );
}
