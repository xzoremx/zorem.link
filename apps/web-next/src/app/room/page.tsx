'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { storiesAPI, storage } from '@/lib';
import type { Story } from '@/types';

export default function RoomPage() {
    const router = useRouter();
    const [stories, setStories] = useState<Story[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const viewerHash = storage.getViewerHash();
        const roomId = storage.getRoomId();

        if (!viewerHash || !roomId) {
            router.push('/');
            return;
        }

        loadStories(roomId, viewerHash);

        // Poll for new stories
        const interval = setInterval(() => loadStories(roomId, viewerHash), 10000);
        return () => clearInterval(interval);
    }, [router]);

    const loadStories = async (roomId: string, viewerHash: string) => {
        try {
            const result = await storiesAPI.getStories(roomId, viewerHash);
            setStories(result.stories || []);
            if (result.stories?.length > 0 && currentIndex === -1) {
                setCurrentIndex(0);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load stories');
        } finally {
            setIsLoading(false);
        }
    };

    const goNext = () => {
        if (currentIndex < stories.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    };

    const goPrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    const currentStory = stories[currentIndex];

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <div className="text-neutral-400">Loading stories...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black flex flex-col">
            {/* Header */}
            <header className="absolute top-0 left-0 right-0 z-50 p-4 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                    <Image src="/logo.png" alt="Zorem" width={28} height={28} />
                </Link>
                <button
                    onClick={() => {
                        storage.clearSession();
                        router.push('/');
                    }}
                    className="text-sm text-white/60 hover:text-white transition-colors"
                >
                    Exit
                </button>
            </header>

            {/* Progress bar */}
            {stories.length > 0 && (
                <div className="absolute top-16 left-4 right-4 z-40 flex gap-1">
                    {stories.map((_, idx) => (
                        <div key={idx} className="flex-1 h-0.5 rounded-full overflow-hidden bg-white/20">
                            <div
                                className={`h-full transition-all duration-300 ${
                                    idx < currentIndex ? 'bg-white w-full' :
                                    idx === currentIndex ? 'bg-white w-1/2' : 'w-0'
                                }`}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Story content */}
            <div className="flex-1 flex items-center justify-center relative">
                {error ? (
                    <div className="text-red-400">{error}</div>
                ) : stories.length === 0 ? (
                    <div className="text-center">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 6v6l4 2" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-medium text-white mb-2">No stories yet</h2>
                        <p className="text-neutral-500 text-sm">Waiting for stories to be uploaded...</p>
                    </div>
                ) : currentStory ? (
                    <>
                        {/* Navigation areas */}
                        <button
                            onClick={goPrev}
                            className="absolute left-0 top-0 bottom-0 w-1/3 z-30"
                            disabled={currentIndex === 0}
                        />
                        <button
                            onClick={goNext}
                            className="absolute right-0 top-0 bottom-0 w-1/3 z-30"
                            disabled={currentIndex === stories.length - 1}
                        />

                        {/* Story media */}
                        {currentStory.media_type === 'image' ? (
                            <img
                                src={currentStory.media_url}
                                alt="Story"
                                className="max-w-full max-h-full object-contain"
                            />
                        ) : (
                            <video
                                src={currentStory.media_url}
                                className="max-w-full max-h-full object-contain"
                                autoPlay
                                playsInline
                                muted
                                loop
                            />
                        )}

                        {/* Story info */}
                        <div className="absolute bottom-8 left-4 right-4 z-40">
                            {currentStory.creator_nickname && (
                                <p className="text-sm text-white/80">
                                    by {currentStory.creator_nickname}
                                </p>
                            )}
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
}
