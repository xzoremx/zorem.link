'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { storiesAPI, storage, uploadToStorage, authAPI, API_BASE_URL } from '@/lib';
import type { Story } from '@/types';

export default function RoomPage() {
    const router = useRouter();
    const [stories, setStories] = useState<Story[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [roomId, setRoomId] = useState<string | null>(null);
    const [viewerHash, setViewerHash] = useState<string | null>(null);
    
    // Upload state
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Auth state
    const [isOwner, setIsOwner] = useState(false);
    const [allowUploads, setAllowUploads] = useState(false);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    
    // Preloaded images cache
    const preloadedImages = useRef<Set<string>>(new Set());
    
    // Like state
    const [isLiking, setIsLiking] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);
    
    // Delete state
    const [isDeleting, setIsDeleting] = useState(false);
    
    const isLoadingRef = useRef(false);
    const forceRefreshMediaUrlForStoryIds = useRef<Set<string>>(new Set());
    const lastMediaRefreshAttemptAt = useRef<Record<string, number>>({});
    const storiesVersionRef = useRef<number | null>(null);

    const areStoriesEqual = (a: Story[], b: Story[]): boolean => {
        if (a.length !== b.length) return false;

        for (let i = 0; i < a.length; i++) {
            const storyA = a[i];
            const storyB = b[i];
            if (!storyA || !storyB) return false;
            if (storyA.id !== storyB.id) return false;
            if (storyA.media_type !== storyB.media_type) return false;
            if (storyA.media_url !== storyB.media_url) return false;
            if (storyA.liked !== storyB.liked) return false;
            if (storyA.like_count !== storyB.like_count) return false;
            if (storyA.view_count !== storyB.view_count) return false;
            if (storyA.viewed !== storyB.viewed) return false;
            if (storyA.creator_nickname !== storyB.creator_nickname) return false;
        }

        return true;
    };

    // Load stories function
    const loadStories = useCallback(async (rId: string, vHash: string) => {
        if (isLoadingRef.current) return;
        isLoadingRef.current = true;

        try {
            const result = await storiesAPI.getStories(rId, vHash);
            const newStories = result.stories || [];

            if ('stories_version' in result) {
                const version = Number((result as { stories_version?: unknown }).stories_version);
                if (Number.isFinite(version)) {
                    storiesVersionRef.current = version;
                }
            }
            
            setStories(prevStories => {
                const prevById = new Map(prevStories.map(story => [story.id, story]));

                const mergedStories = newStories.map(story => {
                    const prev = prevById.get(story.id);
                    if (!prev) return story;

                    // Keep the existing media_url to avoid flicker (S3 presigned URLs change on every poll)
                    const shouldForceRefresh = forceRefreshMediaUrlForStoryIds.current.has(story.id);
                    const mediaUrl = shouldForceRefresh ? story.media_url : (prev.media_url ?? story.media_url);

                    if (shouldForceRefresh && story.media_url && story.media_url !== prev.media_url) {
                        forceRefreshMediaUrlForStoryIds.current.delete(story.id);
                    }

                    return {
                        ...prev,
                        ...story,
                        media_url: mediaUrl,
                    };
                });

                // Check if stories changed
                const storiesChanged = 
                    prevStories.length !== mergedStories.length ||
                    prevStories.some((story, idx) => 
                        !mergedStories[idx] || story.id !== mergedStories[idx].id
                    );

                if (storiesChanged && mergedStories.length > 0) {
                    setCurrentIndex(prev => prev < 0 ? 0 : Math.min(prev, mergedStories.length - 1));
                }

                if (areStoriesEqual(prevStories, mergedStories)) {
                    return prevStories;
                }

                return mergedStories;
            });

            // Get allow_uploads from response if available
            if ('allow_uploads' in result) {
                setAllowUploads(result.allow_uploads as boolean);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load stories');
        } finally {
            setIsLoading(false);
            isLoadingRef.current = false;
        }
    }, []);

    // Check auth and initialize
    useEffect(() => {
        const vHash = storage.getViewerHash();
        const rId = storage.getRoomId();
        const authToken = storage.getAuthToken();

        if (!rId) {
            router.push('/');
            return;
        }

        setRoomId(rId);
        setViewerHash(vHash);

        // Check if user is authenticated (owner)
        if (authToken) {
            authAPI.getMe()
                .then(user => {
                    setIsOwner(true);
                    setUserEmail(user.email);
                })
                .catch(() => {
                    setIsOwner(false);
                });
        }

        loadStories(rId, vHash || '');

        if (typeof window === 'undefined' || !('EventSource' in window)) {
            return;
        }

        const streamUrl = `${API_BASE_URL}/api/stories/room/${encodeURIComponent(rId)}/stream${
            vHash ? `?viewer_hash=${encodeURIComponent(vHash)}` : ''
        }`;

        const eventSource = new EventSource(streamUrl);

        const maybeRefreshStories = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data) as { stories_version?: unknown };
                const nextVersion = Number(data.stories_version);
                if (Number.isFinite(nextVersion) && storiesVersionRef.current === nextVersion) {
                    return;
                }
            } catch {
                // Ignore malformed payloads and refresh anyway.
            }

            loadStories(rId, vHash || '');
        };

        eventSource.addEventListener('connected', maybeRefreshStories as EventListener);
        eventSource.addEventListener('stories_changed', maybeRefreshStories as EventListener);

        eventSource.addEventListener('error', () => {
            // Browser will auto-reconnect; keep logs minimal.
            console.debug('Room SSE connection error (will retry)');
        });

        return () => {
            eventSource.close();
        };
    }, [router, loadStories]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' && currentIndex > 0) {
                setCurrentIndex(prev => prev - 1);
            } else if (e.key === 'ArrowRight' && currentIndex < stories.length - 1) {
                setCurrentIndex(prev => prev + 1);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, stories.length]);

    // Record view when story changes
    const currentStoryId = currentIndex >= 0 ? stories[currentIndex]?.id : null;
    useEffect(() => {
        if (currentStoryId && viewerHash) {
            storiesAPI.recordView(currentStoryId, viewerHash).catch(console.error);
        }
    }, [currentStoryId, viewerHash]);

    // Preload ALL images when stories load for instant navigation
    useEffect(() => {
        if (stories.length === 0) return;

        stories.forEach(story => {
            if (story?.media_url && story.media_type === 'image' && !preloadedImages.current.has(story.media_url)) {
                const img = new window.Image();
                img.src = story.media_url;
                img.onload = () => {
                    preloadedImages.current.add(story.media_url);
                };
            }
        });
    }, [stories]);

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

    const handleLogout = () => {
        storage.clearSession();
        router.push('/');
    };

    const handleLike = async () => {
        if (!currentStory || !viewerHash || isLiking) return;
        
        setIsLiking(true);
        try {
            const result = await storiesAPI.toggleLike(currentStory.id, viewerHash);
            // Update the story in the list
            setStories(prev => prev.map(story => 
                story.id === currentStory.id 
                    ? { ...story, liked: result.liked, like_count: result.like_count }
                    : story
            ));
        } catch (err) {
            console.error('Failed to toggle like:', err);
        } finally {
            setIsLiking(false);
        }
    };

    const handleShare = async () => {
        const roomCode = storage.getRoomCode() || storage.getRoomId();
        const shareUrl = typeof window !== 'undefined' 
            ? `${window.location.origin}/nickname?code=${roomCode}`
            : '';
        
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 2000);
        } catch {
            // Fallback
            const input = document.createElement('input');
            input.value = shareUrl;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 2000);
        }
    };

    const handleDeleteStory = async () => {
        if (!currentStory || !isOwner || isDeleting) return;

        if (!confirm('Are you sure you want to delete this story? This action cannot be undone.')) {
            return;
        }

        setIsDeleting(true);
        try {
            await storiesAPI.delete(currentStory.id);
            
            // Remove story from list
            const newStories = stories.filter(s => s.id !== currentStory.id);
            setStories(newStories);
            
            // Adjust current index
            if (newStories.length === 0) {
                setCurrentIndex(-1);
            } else if (currentIndex >= newStories.length) {
                setCurrentIndex(newStories.length - 1);
            }
        } catch (err) {
            console.error('Failed to delete story:', err);
            alert(err instanceof Error ? err.message : 'Failed to delete story');
        } finally {
            setIsDeleting(false);
        }
    };

    // File upload handlers
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setUploadError('');
            
            // Create preview
            const reader = new FileReader();
            reader.onload = (event) => {
                setFilePreview(event.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile || !roomId) return;

        setIsUploading(true);
        setUploadError('');

        try {
            const mediaType = selectedFile.type.startsWith('image/') ? 'image' : 'video';

            // Get upload URL
            const uploadData = await storiesAPI.getUploadUrl(
                roomId,
                mediaType,
                selectedFile.size,
                selectedFile.type
            );

            // Upload to S3/R2
            await uploadToStorage(uploadData.upload_url, selectedFile);

            // Create story record
            await storiesAPI.create(roomId, uploadData.media_key, mediaType);

            // Reload stories
            if (roomId) {
                await loadStories(roomId, viewerHash || '');
            }

            // Close modal and reset
            closeUploadModal();
        } catch (err) {
            setUploadError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setIsUploading(false);
        }
    };

    const closeUploadModal = () => {
        setShowUploadModal(false);
        setSelectedFile(null);
        setFilePreview(null);
        setUploadError('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const currentStory = stories[currentIndex];
    const canUpload = isOwner || allowUploads;

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
                <div className="flex items-center gap-3">
                    <Link href={isOwner ? "/my-rooms" : "/"} className="text-white/80 hover:text-white">
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                    </Link>
                    <span className="text-sm font-medium text-white">
                        {stories.length > 0 ? `${currentIndex + 1} / ${stories.length}` : '0 / 0'}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    {userEmail && (
                        <span className="text-sm text-white/70 max-w-[150px] truncate hidden sm:block">
                            {userEmail}
                        </span>
                    )}
                    {(isOwner || userEmail) && (
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-sm font-medium text-white transition-all"
                        >
                            Log out
                        </button>
                    )}
                    {canUpload && (
                        <button
                            onClick={() => setShowUploadModal(true)}
                            className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-sm font-medium text-white transition-all"
                        >
                            Upload Story
                        </button>
                    )}
                    {isOwner && currentStory && (
                        <button
                            onClick={handleDeleteStory}
                            disabled={isDeleting}
                            className="px-4 py-2 rounded-full bg-red-500/20 hover:bg-red-500/30 text-sm font-medium text-red-300 transition-all disabled:opacity-50"
                            title="Delete story"
                        >
                            {isDeleting ? 'Deleting...' : (
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                            )}
                        </button>
                    )}
                </div>
            </header>

            {/* Progress bar */}
            {stories.length > 0 && (
                <div className="absolute top-16 left-4 right-4 z-40 flex gap-1">
                    {stories.map((_, idx) => (
                        <div key={idx} className="flex-1 h-0.5 rounded-full overflow-hidden bg-white/20">
                            <div
                                className={`h-full bg-white transition-all duration-300 ${
                                    idx < currentIndex ? 'w-full' :
                                    idx === currentIndex ? 'w-full' : 'w-0'
                                }`}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Story content */}
            <div className="flex-1 flex items-center justify-center relative">
                {error ? (
                    <div className="text-center">
                        <p className="text-red-400 mb-4">{error}</p>
                        <button 
                            onClick={() => roomId && loadStories(roomId, viewerHash || '')}
                            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm text-white"
                        >
                            Retry
                        </button>
                    </div>
                ) : stories.length === 0 ? (
                    <div className="text-center">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 6v6l4 2" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-medium text-white mb-2">No stories yet</h2>
                        <p className="text-neutral-500 text-sm mb-4">Be the first to share!</p>
                        {canUpload && (
                            <button
                                onClick={() => setShowUploadModal(true)}
                                className="px-6 py-3 rounded-xl bg-white text-black font-medium hover:bg-neutral-200 transition-all"
                            >
                                Upload Story
                            </button>
                        )}
                    </div>
                ) : currentStory ? (
                    <>
                        {/* Navigation areas */}
                        <button
                            onClick={goPrev}
                            className="absolute left-0 top-0 bottom-0 w-1/3 z-30 cursor-pointer"
                            disabled={currentIndex === 0}
                            aria-label="Previous story"
                        />
                        <button
                            onClick={goNext}
                            className="absolute right-0 top-0 bottom-0 w-1/3 z-30 cursor-pointer"
                            disabled={currentIndex === stories.length - 1}
                            aria-label="Next story"
                        />

                        {/* Story media */}
                        {currentStory.media_url ? (
                            currentStory.media_type === 'image' ? (
                                <img
                                    key={currentStory.id}
                                    src={currentStory.media_url}
                                    alt="Story"
                                    className="max-w-full max-h-full object-contain"
                                    loading="eager"
                                    decoding="async"
                                    onLoad={() => {
                                        forceRefreshMediaUrlForStoryIds.current.delete(currentStory.id);
                                    }}
                                    onError={() => {
                                        if (!roomId) return;

                                        const now = Date.now();
                                        const lastAttempt = lastMediaRefreshAttemptAt.current[currentStory.id] ?? 0;
                                        if (now - lastAttempt < 5000) return;
                                        lastMediaRefreshAttemptAt.current[currentStory.id] = now;

                                        forceRefreshMediaUrlForStoryIds.current.add(currentStory.id);
                                        loadStories(roomId, viewerHash || '');
                                    }}
                                />
                            ) : (
                                <video
                                    key={currentStory.id}
                                    src={currentStory.media_url}
                                    className="max-w-full max-h-full object-contain"
                                    autoPlay
                                    playsInline
                                    controls
                                    onLoadedData={() => {
                                        forceRefreshMediaUrlForStoryIds.current.delete(currentStory.id);
                                    }}
                                    onError={() => {
                                        if (!roomId) return;

                                        const now = Date.now();
                                        const lastAttempt = lastMediaRefreshAttemptAt.current[currentStory.id] ?? 0;
                                        if (now - lastAttempt < 5000) return;
                                        lastMediaRefreshAttemptAt.current[currentStory.id] = now;

                                        forceRefreshMediaUrlForStoryIds.current.add(currentStory.id);
                                        loadStories(roomId, viewerHash || '');
                                    }}
                                />
                            )
                        ) : (
                            <div className="text-center">
                                <p className="text-neutral-400">Story unavailable</p>
                                <p className="text-neutral-600 text-sm">Storage not configured</p>
                            </div>
                        )}

                        {/* Story info and actions */}
                        <div className="absolute bottom-8 left-4 right-4 z-40 flex items-end justify-between">
                            <div>
                                {currentStory.creator_nickname && (
                                    <p className="text-sm text-white/80">
                                        by {currentStory.creator_nickname}
                                    </p>
                                )}
                            </div>
                            
                             {/* Action buttons */}
                             <div className="flex items-center gap-3">
                                {/* Like button / Likes count */}
                                {viewerHash ? (
                                    <button
                                        onClick={handleLike}
                                        disabled={isLiking}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-all"
                                        aria-label={currentStory.liked ? 'Unlike' : 'Like'}
                                    >
                                        <svg
                                            className={`w-5 h-5 transition-all ${currentStory.liked ? 'text-red-500 fill-red-500' : 'text-white'}`}
                                            viewBox="0 0 24 24"
                                            fill={currentStory.liked ? 'currentColor' : 'none'}
                                            stroke="currentColor"
                                            strokeWidth="2"
                                        >
                                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                        </svg>
                                        {(currentStory.like_count ?? 0) > 0 && (
                                            <span className="text-sm text-white font-medium">
                                                {currentStory.like_count}
                                            </span>
                                        )}
                                    </button>
                                ) : (currentStory.like_count ?? 0) > 0 ? (
                                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/40 backdrop-blur-sm">
                                        <svg
                                            className="w-5 h-5 text-white"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                        >
                                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                        </svg>
                                        <span className="text-sm text-white font-medium">
                                            {currentStory.like_count}
                                        </span>
                                    </div>
                                ) : null}
                                
                                {/* Share button */}
                                <button
                                    onClick={handleShare}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-all"
                                    aria-label="Share room"
                                >
                                    {copiedLink ? (
                                        <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                                            <polyline points="16 6 12 2 8 6" />
                                            <line x1="12" y1="2" x2="12" y2="15" />
                                        </svg>
                                    )}
                                    <span className="text-sm text-white font-medium">
                                        {copiedLink ? 'Copied!' : 'Share'}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </>
                ) : null}
            </div>

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
                    <div className="bg-[#0F0F11] rounded-2xl p-8 max-w-md w-full mx-4 border border-white/10">
                        <h2 className="text-xl font-medium text-white mb-4">Upload Story</h2>
                        
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,video/*"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full h-12 rounded-xl bg-white text-black hover:bg-neutral-200 font-medium mb-4 transition-all"
                        >
                            Select File
                        </button>

                        {/* File Preview */}
                        {filePreview && (
                            <div className="mb-4 rounded-lg overflow-hidden bg-black/50">
                                {selectedFile?.type.startsWith('image/') ? (
                                    <img
                                        src={filePreview}
                                        alt="Preview"
                                        className="max-w-full max-h-64 mx-auto object-contain"
                                    />
                                ) : (
                                    <video
                                        src={filePreview}
                                        className="max-w-full max-h-64 mx-auto"
                                        controls
                                    />
                                )}
                            </div>
                        )}

                        {uploadError && (
                            <p className="text-red-400 text-sm mb-4">{uploadError}</p>
                        )}

                        <div className="flex gap-4">
                            <button
                                onClick={closeUploadModal}
                                className="flex-1 h-12 rounded-xl border border-white/10 hover:bg-white/5 font-medium text-white transition-all"
                            >
                                Cancel
                            </button>
                            {selectedFile && (
                                <button
                                    onClick={handleUpload}
                                    disabled={isUploading}
                                    className="flex-1 h-12 rounded-xl bg-white text-black hover:bg-neutral-200 font-medium transition-all disabled:opacity-50"
                                >
                                    {isUploading ? 'Uploading...' : 'Upload'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
