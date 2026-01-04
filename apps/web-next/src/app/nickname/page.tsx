'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { viewerAPI, emojisAPI, storage, BASE_EMOJI_LIST, DEFAULT_AVATAR, getRandomEmojis } from '@/lib';
import { Button, Input } from '@/components';

function NicknameForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const code = searchParams.get('code') || '';

    const [nickname, setNickname] = useState('');
    const [selectedEmoji, setSelectedEmoji] = useState(DEFAULT_AVATAR);
    const [customEmoji, setCustomEmoji] = useState('');
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState('');
    const [emojiList, setEmojiList] = useState<string[]>(BASE_EMOJI_LIST);

    const emojiScrollRef = useRef<HTMLDivElement>(null);

    // Fetch trending emojis on mount
    useEffect(() => {
        async function loadTrendingEmojis() {
            try {
                const { trending } = await emojisAPI.getTrending();
                // Combine: trending (up to 20) + random from base list (8)
                const randomFromBase = getRandomEmojis(8).filter(e => !trending.includes(e));
                const combined = [...trending.slice(0, 20), ...randomFromBase];
                // Remove duplicates
                const unique = [...new Set(combined)];
                setEmojiList(unique.length > 0 ? unique : BASE_EMOJI_LIST);
            } catch {
                // Fallback to base list
                setEmojiList(BASE_EMOJI_LIST);
            }
        }
        loadTrendingEmojis();
    }, []);

    const handleEmojiSelect = (emoji: string) => {
        setSelectedEmoji(emoji);
        setShowCustomInput(false);
        setCustomEmoji('');
    };

    const handleCustomEmojiChange = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) {
            setCustomEmoji('');
            setSelectedEmoji(DEFAULT_AVATAR);
            return;
        }

        let lastGrapheme = '';
        try {
            const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
            const segments = Array.from(segmenter.segment(trimmed));
            lastGrapheme = segments[segments.length - 1]?.segment ?? '';
        } catch {
            const parts = Array.from(trimmed);
            lastGrapheme = parts[parts.length - 1] ?? '';
        }

        const codePoints = Array.from(lastGrapheme);
        if (codePoints.length === 0 || codePoints.length > 10) {
            return;
        }

        const looksLikeEmoji = codePoints.some((char) => {
            const codePoint = char.codePointAt(0) ?? 0;
            return (
                (codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff) || // Flags (regional indicators)
                codePoint >= 0x1f300 || // Most emoji live here
                (codePoint >= 0x2600 && codePoint <= 0x27bf) // Misc symbols
            );
        });

        if (!looksLikeEmoji) {
            return;
        }

        setCustomEmoji(lastGrapheme);
        setSelectedEmoji(lastGrapheme);
    };

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
            const displayName = nickname.trim();

            const result = await viewerAPI.join(code, displayName, selectedEmoji);

            storage.setViewerHash(result.viewer_hash);
            storage.setRoomId(result.room_id);
            storage.setRoomCode(result.room_code);
            localStorage.setItem('viewer_avatar', result.avatar || selectedEmoji);

            router.push('/room');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to join room');
        } finally {
            setIsJoining(false);
        }
    };

    const scrollEmojis = (direction: 'left' | 'right') => {
        if (emojiScrollRef.current) {
            const scrollAmount = 200;
            emojiScrollRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    return (
        <div className="glass rounded-2xl p-8">
            <h1 className="text-2xl font-medium text-white text-center mb-2">Join Room</h1>
            <p className="text-neutral-400 text-sm text-center mb-6">
                Room code: <span className="font-mono text-white">{code}</span>
            </p>

            {/* Avatar Preview */}
            <div className="flex flex-col items-center mb-6">
                <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-500/30 to-pink-500/30 flex items-center justify-center text-6xl animate-bounce-slow border-4 border-white/10">
                        {selectedEmoji}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-violet-500 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 5v14M5 12h14"/>
                        </svg>
                    </div>
                </div>
                <p className="text-xs text-neutral-500 mt-3">Your avatar</p>
            </div>

            {/* Emoji Selector */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-white">Choose your avatar</label>
                    <button
                        type="button"
                        onClick={() => setShowCustomInput(!showCustomInput)}
                        className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                    >
                        {showCustomInput ? 'Pick from list' : 'Use custom emoji'}
                    </button>
                </div>

                {showCustomInput ? (
                    <div className="relative">
                        <input
                            type="text"
                            value={customEmoji}
                            onChange={(e) => handleCustomEmojiChange(e.target.value)}
                            placeholder="Paste or type an emoji..."
                            className="w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-center text-2xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        />
                        <p className="text-xs text-neutral-500 mt-2 text-center">
                            Paste any emoji from your keyboard
                        </p>
                    </div>
                ) : (
                    <div className="relative">
                        {/* Scroll buttons */}
                        <button
                            type="button"
                            onClick={() => scrollEmojis('left')}
                            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M15 19l-7-7 7-7"/>
                            </svg>
                        </button>
                        <button
                            type="button"
                            onClick={() => scrollEmojis('right')}
                            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 5l7 7-7 7"/>
                            </svg>
                        </button>

                        {/* Emoji scroll container */}
                        <div
                            ref={emojiScrollRef}
                            className="flex gap-2 overflow-x-auto scrollbar-hide px-8 py-2 scroll-smooth"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                            {emojiList.map((emoji) => (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => handleEmojiSelect(emoji)}
                                    className={`flex-shrink-0 w-12 h-12 rounded-xl text-2xl transition-all hover:scale-110 ${
                                        selectedEmoji === emoji
                                            ? 'bg-violet-500/30 border-2 border-violet-500 scale-110'
                                            : 'bg-white/5 border border-white/10 hover:border-white/20'
                                    }`}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Nickname Form */}
            <form onSubmit={handleJoin} className="space-y-4">
                <Input
                    label="Nickname"
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Enter your name"
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

            {/* Custom styles for hiding scrollbar and bounce animation */}
            <style jsx global>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                @keyframes bounce-slow {
                    0%, 100% {
                        transform: translateY(0);
                    }
                    50% {
                        transform: translateY(-8px);
                    }
                }
                .animate-bounce-slow {
                    animation: bounce-slow 2s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}
