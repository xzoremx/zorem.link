'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context';
import { roomsAPI, storiesAPI, uploadToStorage, storage } from '@/lib';
import { Button } from '@/components';

const DURATION_OPTIONS = [
    { value: '24h', label: '24 Hours', desc: '1 day' },
    { value: '72h', label: '72 Hours', desc: '3 days' },
    { value: '7d', label: '7 Days', desc: '1 week' },
];

type Step = 'form' | 'upload' | 'success';

interface RoomData {
    roomId: string;
    code: string;
    qrData: string;
    link: string;
}

export default function CreateRoomPage() {
    const router = useRouter();
    const { isAuthenticated, isLoading: authLoading } = useAuth();

    // Form state
    const [step, setStep] = useState<Step>('form');
    const [duration, setDuration] = useState('24h');
    const [allowUploads, setAllowUploads] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState('');

    // Room data after creation
    const [roomData, setRoomData] = useState<RoomData | null>(null);

    // Upload state
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Copy state
    const [codeCopied, setCodeCopied] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);

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

            // Store room data
            const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
            setRoomData({
                roomId: result.room_id,
                code: result.code,
                qrData: result.qr_data || '',
                link: `${baseUrl}/nickname?code=${result.code}`,
            });

            // Save room ID
            storage.setRoomId(result.room_id);

            // Move to upload step
            setStep('upload');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create room');
        } finally {
            setIsCreating(false);
        }
    };

    const handleFileSelect = useCallback((file: File) => {
        // Validate file size (50MB max)
        const maxSize = 50 * 1024 * 1024;
        if (file.size > maxSize) {
            setUploadError('File size exceeds 50MB limit');
            return;
        }

        // Validate file type
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            setUploadError('Please select an image or video file');
            return;
        }

        setSelectedFile(file);
        setUploadError('');

        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
            setFilePreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    }, [handleFileSelect]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragOver(false);
    }, []);

    const handleRemoveFile = () => {
        setSelectedFile(null);
        setFilePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleUploadStory = async () => {
        if (!selectedFile || !roomData) return;

        setIsUploading(true);
        setUploadError('');

        try {
            const mediaType = selectedFile.type.startsWith('image/') ? 'image' : 'video';

            // Get upload URL
            const uploadData = await storiesAPI.getUploadUrl(
                roomData.roomId,
                mediaType,
                selectedFile.size,
                selectedFile.type
            );

            // Upload to S3/R2
            await uploadToStorage(uploadData.upload_url, selectedFile);

            // Confirm story creation
            await storiesAPI.create(roomData.roomId, uploadData.media_key, mediaType);

            // Move to success step
            setStep('success');
        } catch (err) {
            setUploadError(err instanceof Error ? err.message : 'Failed to upload story');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSkipUpload = () => {
        setStep('success');
    };

    const handleCopyCode = async () => {
        if (!roomData) return;
        await navigator.clipboard.writeText(roomData.code);
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
    };

    const handleCopyLink = async () => {
        if (!roomData) return;
        await navigator.clipboard.writeText(roomData.link);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
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

            <div className="relative z-10 w-full max-w-lg">
                {/* Logo */}
                <div className="flex justify-center mb-8">
                    <Link href="/">
                        <Image src="/logo.png" alt="Zorem" width={48} height={48} className="logo-spin" />
                    </Link>
                </div>

                {/* Step 1: Create Room Form */}
                {step === 'form' && (
                    <div className="glass rounded-2xl p-8 animate-fade-up">
                        <h1 className="text-2xl font-medium text-white text-center mb-2">Create Your Room</h1>
                        <p className="text-neutral-400 text-sm text-center mb-8">
                            Set up a private space for sharing stories
                        </p>

                        <div className="space-y-6">
                            {/* Duration */}
                            <div>
                                <label className="text-sm font-medium text-white mb-3 block">Duration</label>
                                <div className="grid grid-cols-3 gap-4">
                                    {DURATION_OPTIONS.map((opt) => (
                                        <label key={opt.value} className="cursor-pointer">
                                            <input
                                                type="radio"
                                                name="duration"
                                                value={opt.value}
                                                checked={duration === opt.value}
                                                onChange={() => setDuration(opt.value)}
                                                className="hidden peer"
                                            />
                                            <div className="p-4 rounded-xl border border-white/10 peer-checked:border-white/30 peer-checked:bg-white/5 text-center transition-all">
                                                <div className="text-lg font-medium text-white">{opt.label.split(' ')[0]}</div>
                                                <div className="text-xs text-neutral-500 mt-1">{opt.desc}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Allow Uploads */}
                            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                                <div>
                                    <div className="text-sm font-medium text-white">Allow viewers to upload stories</div>
                                    <div className="text-xs text-neutral-500 mt-1">Let others contribute to your room</div>
                                </div>
                                <button
                                    onClick={() => setAllowUploads(!allowUploads)}
                                    className={`w-12 h-6 rounded-full transition-all relative ${allowUploads ? 'bg-violet-500' : 'bg-white/10'
                                        }`}
                                >
                                    <div className={`w-5 h-5 rounded-full bg-white transition-transform absolute top-0.5 ${allowUploads ? 'left-6' : 'left-0.5'
                                        }`} />
                                </button>
                            </div>

                            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

                            <Button onClick={handleCreate} disabled={isCreating} className="w-full">
                                {isCreating ? 'Creating...' : 'Create Room'}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 2: Upload First Story */}
                {step === 'upload' && (
                    <div className="glass rounded-2xl p-8 animate-fade-up">
                        <div className="text-center mb-8">
                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500/20 to-pink-500/20 flex items-center justify-center mx-auto mb-6">
                                <svg className="w-10 h-10 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="17 8 12 3 7 8" />
                                    <line x1="12" y1="3" x2="12" y2="15" />
                                </svg>
                            </div>
                            <h2 className="text-3xl font-medium text-white mb-3">Your Room is Ready!</h2>
                            <p className="text-lg text-neutral-400 mb-2">Start by sharing your first story</p>
                            <p className="text-sm text-neutral-500">Make it memorable. This is how your room begins.</p>
                        </div>

                        {/* Upload Area */}
                        <div className="mb-6">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*,video/*"
                                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                                className="hidden"
                            />

                            {!filePreview ? (
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all group ${isDragOver
                                            ? 'border-violet-500/50 bg-violet-500/5'
                                            : 'border-white/20 hover:border-violet-500/50'
                                        }`}
                                >
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-16 h-16 rounded-full bg-white/5 group-hover:bg-violet-500/10 flex items-center justify-center transition-all">
                                            <svg className="w-8 h-8 text-neutral-400 group-hover:text-violet-400 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                <polyline points="17 8 12 3 7 8" />
                                                <line x1="12" y1="3" x2="12" y2="15" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-white font-medium mb-1">Drop your story here</p>
                                            <p className="text-sm text-neutral-500">or click to browse</p>
                                            <p className="text-xs text-neutral-600 mt-2">Images or videos up to 50MB</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="relative rounded-xl overflow-hidden border border-white/10">
                                    {selectedFile?.type.startsWith('image/') ? (
                                        <img src={filePreview} alt="Preview" className="w-full max-h-64 object-cover" />
                                    ) : (
                                        <video src={filePreview} controls className="w-full max-h-64" />
                                    )}
                                    <button
                                        onClick={handleRemoveFile}
                                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center"
                                    >
                                        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                    </button>
                                </div>
                            )}
                        </div>

                        {uploadError && <p className="text-red-400 text-sm text-center mb-4">{uploadError}</p>}

                        <div className="flex gap-4">
                            <button
                                onClick={handleSkipUpload}
                                className="flex-1 h-12 rounded-xl border border-white/10 hover:bg-white/5 font-medium text-neutral-400 hover:text-white transition-all"
                            >
                                Skip for now
                            </button>
                            <button
                                onClick={handleUploadStory}
                                disabled={!selectedFile || isUploading}
                                className="flex-1 h-12 rounded-xl bg-white text-black hover:bg-neutral-200 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isUploading ? 'Uploading...' : 'Upload Story'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Success Card */}
                {step === 'success' && roomData && (
                    <div className="glass rounded-2xl p-8 animate-fade-up">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 rounded-full bg-violet-500/20 flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-medium text-white mb-2">Room Created!</h2>
                            <p className="text-neutral-400">Share this code with your friends</p>
                        </div>

                        {/* Room Code */}
                        <div className="mb-6">
                            <div className="text-center mb-4">
                                <div className="text-5xl font-mono font-bold text-white mb-2">{roomData.code}</div>
                                <button
                                    onClick={handleCopyCode}
                                    className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
                                >
                                    {codeCopied ? 'Copied!' : 'Copy code'}
                                </button>
                            </div>

                            {/* QR Code */}
                            {roomData.qrData && (
                                <div className="flex justify-center mb-6">
                                    <img
                                        src={roomData.qrData}
                                        alt="QR Code"
                                        className="w-48 h-48 rounded-xl border border-white/10"
                                    />
                                </div>
                            )}

                            {/* Share Link */}
                            <div className="mb-6">
                                <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2 block">
                                    Share Link
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={roomData.link}
                                        readOnly
                                        className="flex-1 h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white"
                                    />
                                    <button
                                        onClick={handleCopyLink}
                                        className="px-4 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium text-white transition-all"
                                    >
                                        {linkCopied ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <Link
                                href="/"
                                className="flex-1 h-12 rounded-xl border border-white/10 hover:bg-white/5 flex items-center justify-center font-medium text-neutral-400 hover:text-white transition-all"
                            >
                                Back to Home
                            </Link>
                            <button
                                onClick={() => router.push(`/room?room_id=${roomData.roomId}`)}
                                className="flex-1 h-12 rounded-xl bg-white text-black hover:bg-neutral-200 font-medium transition-all"
                            >
                                View Room
                            </button>
                        </div>
                    </div>
                )}

                <p className="text-center text-neutral-500 text-xs mt-6">
                    <Link href="/my-rooms" className="hover:text-white transition-colors">← Back to My Rooms</Link>
                </p>
            </div>
        </div>
    );
}
