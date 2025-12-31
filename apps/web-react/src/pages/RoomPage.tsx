/**
 * RoomPage - View stories in a room
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/context';
import { storiesAPI, uploadToStorage, storage, authAPI } from '@/lib';
import { Button, Card, CardContent } from '@/components/ui';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeft, ChevronLeft, ChevronRight, Upload, X, Plus } from 'lucide-react';
import type { Story } from '@/types';

export function RoomPage() {
    const [searchParams] = useSearchParams();
    const { logout } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [roomId, setRoomId] = useState<string | null>(null);
    const [stories, setStories] = useState<Story[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [isOwner, setIsOwner] = useState(false);

    // Upload state
    const [showUpload, setShowUpload] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        const id = searchParams.get('room_id') || storage.getRoomId();
        if (id) {
            setRoomId(id);
            checkAuth();
            loadStories(id);
        }
    }, [searchParams]);

    async function checkAuth() {
        const token = storage.getAuthToken();
        if (token) {
            try {
                const user = await authAPI.getMe();
                setUserEmail(user.email);
                setIsOwner(true);
            } catch {
                storage.clearAuthToken();
            }
        }
    }

    const loadStories = useCallback(async (id: string) => {
        try {
            const viewerHash = storage.getViewerHash();
            const result = await storiesAPI.getStories(id, viewerHash || undefined);
            setStories(result.stories || []);
        } catch (err) {
            setError((err as Error).message || 'Failed to load stories');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Auto-refresh stories
    useEffect(() => {
        if (!roomId) return;
        const interval = setInterval(() => loadStories(roomId), 10000);
        return () => clearInterval(interval);
    }, [roomId, loadStories]);

    // Keyboard navigation
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'ArrowLeft' && currentIndex > 0) {
                setCurrentIndex(currentIndex - 1);
            } else if (e.key === 'ArrowRight' && currentIndex < stories.length - 1) {
                setCurrentIndex(currentIndex + 1);
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, stories.length]);

    async function handleUpload() {
        if (!selectedFile || !roomId) return;

        setIsUploading(true);
        setError('');

        try {
            const mediaType = selectedFile.type.startsWith('image/') ? 'image' : 'video';
            const uploadData = await storiesAPI.getUploadUrl(roomId, mediaType, selectedFile.size, selectedFile.type);
            await uploadToStorage(uploadData.upload_url, selectedFile);
            await storiesAPI.create(roomId, uploadData.media_key, mediaType);

            setShowUpload(false);
            setSelectedFile(null);
            setPreviewUrl('');
            loadStories(roomId);
        } catch (err) {
            setError((err as Error).message || 'Failed to upload story');
        } finally {
            setIsUploading(false);
        }
    }

    function handleFileSelect(file: File) {
        if (file.size > 50 * 1024 * 1024) {
            setError('File size exceeds 50MB limit');
            return;
        }
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setError('');
    }

    const currentStory = stories[currentIndex];

    return (
        <div className="min-h-screen bg-black flex flex-col">
            {/* Header */}
            <header className="relative z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
                <Link to="/" className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                    <span>Exit</span>
                </Link>

                {/* Progress indicators */}
                {stories.length > 0 && (
                    <div className="absolute left-1/2 -translate-x-1/2 flex gap-1.5">
                        {stories.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrentIndex(i)}
                                className={`h-1 rounded-full transition-all ${i === currentIndex ? 'w-8 bg-white' : 'w-4 bg-white/30'
                                    }`}
                            />
                        ))}
                    </div>
                )}

                <div className="flex items-center gap-3">
                    {userEmail && (
                        <span className="text-sm text-neutral-500 hidden sm:block">{userEmail}</span>
                    )}
                    {isOwner && (
                        <button onClick={logout} className="text-sm text-neutral-400 hover:text-white">
                            Log out
                        </button>
                    )}
                </div>
            </header>

            {/* Main Story View */}
            <main className="flex-1 relative flex items-center justify-center">
                {isLoading ? (
                    <div className="text-neutral-400">Loading stories...</div>
                ) : error ? (
                    <div className="text-red-400">{error}</div>
                ) : stories.length === 0 ? (
                    <Card className="max-w-md mx-auto">
                        <CardContent className="text-center py-12">
                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                                <Plus className="w-8 h-8 text-neutral-500" />
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">No stories yet</h3>
                            <p className="text-neutral-400 mb-6">Be the first to share a story</p>
                            <Button onClick={() => setShowUpload(true)}>
                                <Upload className="w-4 h-4" />
                                Add Story
                            </Button>
                        </CardContent>
                    </Card>
                ) : currentStory && (
                    <>
                        {currentStory.media_type === 'image' ? (
                            <img
                                src={currentStory.media_url}
                                alt="Story"
                                className="max-h-[80vh] max-w-full object-contain"
                            />
                        ) : (
                            <video
                                src={currentStory.media_url}
                                controls
                                autoPlay
                                className="max-h-[80vh] max-w-full"
                            />
                        )}

                        {/* Navigation */}
                        {currentIndex > 0 && (
                            <button
                                onClick={() => setCurrentIndex(currentIndex - 1)}
                                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                        )}
                        {currentIndex < stories.length - 1 && (
                            <button
                                onClick={() => setCurrentIndex(currentIndex + 1)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                            >
                                <ChevronRight className="w-6 h-6" />
                            </button>
                        )}

                        {/* Story info */}
                        {currentStory.creator_nickname && (
                            <div className="absolute bottom-20 left-4 text-sm text-white/70">
                                Posted by {currentStory.creator_nickname}
                            </div>
                        )}
                    </>
                )}
            </main>

            {/* Upload Button */}
            <footer className="relative z-20 p-4 flex justify-center bg-gradient-to-t from-black/80 to-transparent">
                <Button onClick={() => setShowUpload(true)}>
                    <Upload className="w-4 h-4" />
                    Add Story
                </Button>
            </footer>

            {/* Upload Dialog */}
            <Dialog.Root open={showUpload} onOpenChange={setShowUpload}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" />
                    <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md">
                        <Card>
                            <CardContent>
                                <div className="flex items-center justify-between mb-6">
                                    <Dialog.Title className="text-xl font-medium text-white">
                                        Add Story
                                    </Dialog.Title>
                                    <Dialog.Close asChild>
                                        <button className="text-neutral-400 hover:text-white">
                                            <X className="w-5 h-5" />
                                        </button>
                                    </Dialog.Close>
                                </div>

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*,video/*"
                                    className="hidden"
                                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                                />

                                {!previewUrl ? (
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full border-2 border-dashed border-white/20 rounded-xl p-12 text-center hover:border-violet-500/50 transition-all"
                                    >
                                        <Upload className="w-10 h-10 mx-auto mb-3 text-neutral-400" />
                                        <p className="text-white font-medium">Select file</p>
                                        <p className="text-sm text-neutral-500">Images or videos up to 50MB</p>
                                    </button>
                                ) : (
                                    <div className="relative rounded-xl overflow-hidden border border-white/10 mb-4">
                                        {selectedFile?.type.startsWith('image/') ? (
                                            <img src={previewUrl} alt="Preview" className="w-full max-h-64 object-cover" />
                                        ) : (
                                            <video src={previewUrl} controls className="w-full max-h-64" />
                                        )}
                                        <button
                                            onClick={() => {
                                                setSelectedFile(null);
                                                setPreviewUrl('');
                                            }}
                                            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                )}

                                {error && <p className="text-red-400 text-sm text-center mt-4">{error}</p>}

                                <div className="flex gap-3 mt-6">
                                    <Button variant="outline" className="flex-1" onClick={() => setShowUpload(false)}>
                                        Cancel
                                    </Button>
                                    <Button
                                        className="flex-1"
                                        disabled={!selectedFile || isUploading}
                                        onClick={handleUpload}
                                    >
                                        {isUploading ? 'Uploading...' : 'Upload'}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </div>
    );
}
