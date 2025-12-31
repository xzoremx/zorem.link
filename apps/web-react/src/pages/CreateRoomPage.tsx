/**
 * CreateRoomPage - Protected page for creating a new room
 */

import { useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context';
import { roomsAPI, storiesAPI, uploadToStorage, storage } from '@/lib';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { cn } from '@/lib/utils';
import { ArrowLeft, Upload, X, Check } from 'lucide-react';

type Duration = '24h' | '72h' | '7d';
type Step = 'form' | 'upload' | 'success';

export function CreateRoomPage() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form state
    const [step, setStep] = useState<Step>('form');
    const [duration, setDuration] = useState<Duration>('24h');
    const [allowUploads, setAllowUploads] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Room result state
    const [roomId, setRoomId] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [roomQr, setRoomQr] = useState('');

    // File upload state
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState('');

    async function handleCreateRoom(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const result = await roomsAPI.create(duration, allowUploads);
            setRoomId(result.room_id);
            setRoomCode(result.code);
            setRoomQr(result.qr_data);
            storage.setRoomId(result.room_id);
            setStep('upload');
        } catch (err) {
            setError((err as Error).message || 'Failed to create room');
        } finally {
            setIsLoading(false);
        }
    }

    const handleFileSelect = useCallback((file: File) => {
        // Validate file size (50MB max)
        if (file.size > 50 * 1024 * 1024) {
            setError('File size exceeds 50MB limit');
            return;
        }

        // Validate file type
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            setError('Please select an image or video file');
            return;
        }

        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setError('');
    }, []);

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    }

    async function handleUploadStory() {
        if (!selectedFile || !roomId) return;

        setIsLoading(true);
        setError('');

        try {
            const mediaType = selectedFile.type.startsWith('image/') ? 'image' : 'video';
            const uploadData = await storiesAPI.getUploadUrl(roomId, mediaType, selectedFile.size, selectedFile.type);
            await uploadToStorage(uploadData.upload_url, selectedFile);
            await storiesAPI.create(roomId, uploadData.media_key, mediaType);
            setStep('success');
        } catch (err) {
            setError((err as Error).message || 'Failed to upload story');
        } finally {
            setIsLoading(false);
        }
    }

    function copyToClipboard(text: string) {
        navigator.clipboard.writeText(text);
    }

    const roomLink = `${window.location.origin}/nickname?code=${roomCode}`;

    return (
        <div className="min-h-screen bg-background p-4">
            {/* Background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[80%] h-[600px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-violet-900/20 via-background to-background blur-[100px] opacity-50" />
            </div>

            {/* Navigation */}
            <nav className="relative z-10 max-w-7xl mx-auto mb-8 flex items-center justify-between">
                <Link to="/" className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                    <span>Back</span>
                </Link>
                <div className="flex items-center gap-3">
                    <Link to="/my-rooms" className="text-sm text-neutral-400 hover:text-white transition-colors">
                        My Rooms
                    </Link>
                    <span className="text-sm text-neutral-500 max-w-[220px] truncate" title={user?.email}>
                        {user?.email}
                    </span>
                    <button
                        onClick={logout}
                        className="text-sm text-neutral-400 hover:text-white transition-colors"
                    >
                        Log out
                    </button>
                </div>
            </nav>

            {/* Main Content */}
            <main className="relative z-10 max-w-2xl mx-auto">
                <div className="text-center mb-8 animate-fade-up">
                    <h1 className="text-4xl md:text-5xl font-medium tracking-tight mb-4 text-white">
                        Create Your Room
                    </h1>
                    <p className="text-neutral-400">Set up a private space for sharing stories</p>
                </div>

                {/* Form Step */}
                {step === 'form' && (
                    <Card className="animate-fade-up">
                        <form onSubmit={handleCreateRoom} className="space-y-6">
                            {/* Duration */}
                            <div>
                                <label className="text-sm font-medium text-white mb-3 block">Duration</label>
                                <div className="grid grid-cols-3 gap-4">
                                    {(['24h', '72h', '7d'] as Duration[]).map((d) => (
                                        <label key={d} className="cursor-pointer">
                                            <input
                                                type="radio"
                                                name="duration"
                                                value={d}
                                                checked={duration === d}
                                                onChange={() => setDuration(d)}
                                                className="hidden peer"
                                            />
                                            <div className={cn(
                                                'p-4 rounded-xl border text-center transition-all',
                                                duration === d
                                                    ? 'border-white/30 bg-white/5'
                                                    : 'border-white/10 hover:border-white/20'
                                            )}>
                                                <div className="text-lg font-medium text-white">{d}</div>
                                                <div className="text-xs text-neutral-500 mt-1">
                                                    {d === '24h' ? '1 day' : d === '72h' ? '3 days' : '1 week'}
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Allow Uploads */}
                            <label className="flex items-center justify-between cursor-pointer">
                                <div>
                                    <div className="text-sm font-medium text-white">Allow viewers to upload stories</div>
                                    <div className="text-xs text-neutral-500 mt-1">Let others contribute to your room</div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={allowUploads}
                                    onChange={(e) => setAllowUploads(e.target.checked)}
                                    className="w-12 h-6 rounded-full bg-white/10 border-white/20 checked:bg-violet-500 appearance-none relative transition-colors cursor-pointer"
                                />
                            </label>

                            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? 'Creating...' : 'Create Room'}
                            </Button>
                        </form>
                    </Card>
                )}

                {/* Upload Step */}
                {step === 'upload' && (
                    <Card className="animate-fade-up">
                        <CardHeader className="text-center">
                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500/20 to-pink-500/20 flex items-center justify-center mx-auto mb-6 animate-pulse">
                                <Upload className="w-10 h-10 text-violet-400" />
                            </div>
                            <CardTitle className="text-3xl">Your Room is Ready!</CardTitle>
                            <CardDescription className="text-lg">Start by sharing your first story</CardDescription>
                        </CardHeader>

                        <CardContent>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*,video/*"
                                className="hidden"
                                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                            />

                            {!previewUrl ? (
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={handleDrop}
                                    className="border-2 border-dashed border-white/20 rounded-xl p-12 text-center cursor-pointer hover:border-violet-500/50 transition-all group"
                                >
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-16 h-16 rounded-full bg-white/5 group-hover:bg-violet-500/10 flex items-center justify-center transition-all">
                                            <Upload className="w-8 h-8 text-neutral-400 group-hover:text-violet-400 transition-colors" />
                                        </div>
                                        <div>
                                            <p className="text-white font-medium mb-1">Drop your story here</p>
                                            <p className="text-sm text-neutral-500">or click to browse</p>
                                            <p className="text-xs text-neutral-600 mt-2">Images or videos up to 50MB</p>
                                        </div>
                                    </div>
                                </div>
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
                                        <X className="w-5 h-5 text-white" />
                                    </button>
                                </div>
                            )}

                            {error && <p className="text-red-400 text-sm text-center mb-4">{error}</p>}

                            <div className="flex gap-4 mt-6">
                                <Button variant="outline" className="flex-1" onClick={() => setStep('success')}>
                                    Skip for now
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={handleUploadStory}
                                    disabled={!selectedFile || isLoading}
                                >
                                    {isLoading ? 'Uploading...' : 'Upload Story'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Success Step */}
                {step === 'success' && (
                    <Card className="animate-fade-up">
                        <CardHeader className="text-center">
                            <div className="w-16 h-16 rounded-full bg-violet-500/20 flex items-center justify-center mx-auto mb-4">
                                <Check className="w-8 h-8 text-violet-400" />
                            </div>
                            <CardTitle>Room Created!</CardTitle>
                            <CardDescription>Share this code with your friends</CardDescription>
                        </CardHeader>

                        <CardContent>
                            {/* Room Code */}
                            <div className="text-center mb-6">
                                <div className="text-5xl font-mono font-bold text-white mb-2">{roomCode}</div>
                                <button
                                    onClick={() => copyToClipboard(roomCode)}
                                    className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
                                >
                                    Copy code
                                </button>
                            </div>

                            {/* QR Code */}
                            {roomQr && (
                                <div className="flex justify-center mb-6">
                                    <img src={roomQr} alt="QR Code" className="w-48 h-48 rounded-xl border border-white/10" />
                                </div>
                            )}

                            {/* Share Link */}
                            <div className="mb-6">
                                <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2 block">
                                    Share Link
                                </label>
                                <div className="flex gap-2">
                                    <Input
                                        type="text"
                                        value={roomLink}
                                        readOnly
                                        className="flex-1 !h-12 !px-4 !text-sm"
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="!h-12"
                                        onClick={() => copyToClipboard(roomLink)}
                                    >
                                        Copy
                                    </Button>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <Link to="/" className="flex-1">
                                    <Button variant="outline" className="w-full">Back to Home</Button>
                                </Link>
                                <Button className="flex-1" onClick={() => navigate(`/room?room_id=${roomId}`)}>
                                    View Room
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </main>
        </div>
    );
}
