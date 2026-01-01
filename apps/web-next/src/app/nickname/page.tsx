'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { viewerAPI, storage } from '@/lib';
import { Button, Input } from '@/components';

function NicknameForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const code = searchParams.get('code') || '';
    
    const [nickname, setNickname] = useState('');
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState('');

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!nickname.trim()) {
            setError('Please enter a nickname');
            return;
        }

        if (!code) {
            setError('No room code provided');
            return;
        }

        setIsJoining(true);
        setError('');

        try {
            const result = await viewerAPI.join(code, nickname.trim());
            storage.setViewerHash(result.viewer_hash);
            storage.setRoomId(result.room_id);
            storage.setRoomCode(result.room_code);
            router.push('/room');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to join room');
        } finally {
            setIsJoining(false);
        }
    };

    return (
        <div className="glass rounded-2xl p-8">
            <h1 className="text-2xl font-medium text-white text-center mb-2">Join Room</h1>
            <p className="text-neutral-400 text-sm text-center mb-2">
                Room code: <span className="font-mono text-white">{code}</span>
            </p>
            <p className="text-neutral-500 text-xs text-center mb-8">
                Choose a nickname to identify yourself
            </p>

            <form onSubmit={handleJoin} className="space-y-4">
                <Input
                    label="Nickname"
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Your nickname"
                    maxLength={20}
                    required
                />

                {error && <p className="text-red-400 text-sm">{error}</p>}

                <Button type="submit" disabled={isJoining} className="w-full">
                    {isJoining ? 'Joining...' : 'Enter Room'}
                </Button>
            </form>
        </div>
    );
}

export default function NicknamePage() {
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

                <Suspense fallback={<div className="text-neutral-400 text-center">Loading...</div>}>
                    <NicknameForm />
                </Suspense>

                <p className="text-center text-neutral-500 text-xs mt-6">
                    <Link href="/" className="hover:text-white transition-colors">← Back to home</Link>
                </p>
            </div>
        </div>
    );
}
