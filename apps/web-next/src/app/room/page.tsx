'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { storiesAPI, storage, uploadToStorage, authAPI } from '@/lib';
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
    
    const isLoadingRef = useRef(false);

    // Load stories function
    const loadStories = useCallback(async (rId: string, vHash: string) => {
        if (isLoadingRef.current) return;
        isLoadingRef.current = true;

        try {
            const result = await storiesAPI.getStories(rId, vHash);
            const newStories = result.stories || [];
            
            setStories(prevStories => {
                // Check if stories changed
                const storiesChanged = 
                    prevStories.length !== newStories.length ||
                    prevStories.some((story, idx) => 
                        !newStories[idx] || story.id !== newStories[idx].id
                    );

                if (storiesChanged && newStories.length > 0) {
                    setCurrentIndex(prev => prev < 0 ? 0 : Math.min(prev, newStories.length - 1));
                }
                
                return newStories;
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

        // Poll for new stories
        const interval = setInterval(() => loadStories(rId, vHash || ''), 10000);
        return () => clearInterval(interval);
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
    useEffect(() => {
        if (currentIndex >= 0 && stories[currentIndex] && viewerHash) {
            storiesAPI.recordView(stories[currentIndex].id, viewerHash).catch(console.error);
        }
    }, [currentIndex, stories, viewerHash]);

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
                    <Link href="/" className="text-white/80 hover:text-white">
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
                                    src={currentStory.media_url}
                                    alt="Story"
                                    className="max-w-full max-h-full object-contain"
                                />
                            ) : (
                                <video
                                    key={currentStory.id}
                                    src={currentStory.media_url}
                                    className="max-w-full max-h-full object-contain"
                                    autoPlay
                                    playsInline
                                    controls
                                />
                            )
                        ) : (
                            <div className="text-center">
                                <p className="text-neutral-400">Story unavailable</p>
                                <p className="text-neutral-600 text-sm">Storage not configured</p>
                            </div>
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
