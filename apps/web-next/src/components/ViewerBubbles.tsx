'use client';

import { useState } from 'react';
import type { ViewerInfo, ViewerListItem } from '@/types';
import { roomsAPI } from '@/lib';

interface ViewerBubblesProps {
    roomId: string;
    viewers: ViewerInfo[];
    totalCount: number;
}

export function ViewerBubbles({ roomId, viewers, totalCount }: ViewerBubblesProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [allViewers, setAllViewers] = useState<ViewerListItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const loadViewers = async () => {
        setIsLoading(true);
        try {
            const result = await roomsAPI.getViewers(roomId);
            setAllViewers(result.viewers);
        } catch (err) {
            console.error('Failed to load viewers:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClick = async () => {
        setIsModalOpen(true);
        // Always refresh when opening modal
        loadViewers();
    };

    const formatTimeAgo = (isoDate: string) => {
        const date = new Date(isoDate);
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    };

    if (viewers.length === 0) {
        return null;
    }

    return (
        <>
            <button
                onClick={handleClick}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
                {/* Overlapping bubbles */}
                <div className="flex -space-x-2">
                    {viewers.slice(0, 5).map((v, i) => (
                        <div
                            key={i}
                            className="w-8 h-8 rounded-full bg-white/10 border-2 border-[#0a0a0a] flex items-center justify-center text-sm shrink-0"
                            title={v.nickname}
                        >
                            {v.avatar}
                        </div>
                    ))}
                </div>
                {/* Counter if there are more */}
                {totalCount > 5 && (
                    <span className="text-xs text-neutral-400">
                        +{totalCount - 5} more
                    </span>
                )}
            </button>

            {/* Modal */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                    onClick={() => setIsModalOpen(false)}
                >
                    <div
                        className="w-full max-w-md max-h-[70vh] overflow-hidden rounded-2xl bg-[#0a0a0a] border border-white/10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                            <h3 className="text-lg font-medium text-white">
                                Viewers ({totalCount})
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
                            >
                                <svg className="w-5 h-5 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 6L6 18M6 6l12 12"/>
                                </svg>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="overflow-y-auto max-h-[calc(70vh-60px)]">
                            {isLoading ? (
                                <div className="p-8 text-center text-neutral-400">
                                    Loading viewers...
                                </div>
                            ) : allViewers.length === 0 ? (
                                <div className="p-8 text-center text-neutral-400">
                                    No viewers yet
                                </div>
                            ) : (
                                <div className="divide-y divide-white/5">
                                    {allViewers.map((viewer, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center gap-3 p-4 hover:bg-white/5 transition-colors"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xl shrink-0">
                                                {viewer.avatar}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-white font-medium truncate">
                                                    {viewer.nickname}
                                                </div>
                                                <div className="text-xs text-neutral-500">
                                                    {viewer.last_viewed_at
                                                        ? `viewed ${formatTimeAgo(viewer.last_viewed_at)}`
                                                        : `joined ${formatTimeAgo(viewer.joined_at)}`}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
