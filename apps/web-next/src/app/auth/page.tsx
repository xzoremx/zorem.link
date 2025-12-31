'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context';
import { authAPI } from '@/lib';
import { Button, Input } from '@/components';

function AuthForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { login } = useAuth();
    
    const [mode, setMode] = useState<'signin' | 'signup'>(
        searchParams.get('mode') === 'signup' ? 'signup' : 'signin'
    );
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Handle OAuth callback (token in URL)
    useEffect(() => {
        // Check for both 'token' (magic link) and 'oauth_token' (Google OAuth)
        const token = searchParams.get('token') || searchParams.get('oauth_token');
        const userEmail = searchParams.get('email');
        const errorParam = searchParams.get('error') || searchParams.get('oauth_error');
        const verifyToken = searchParams.get('verify');

        if (errorParam) {
            setError(decodeURIComponent(errorParam));
            return;
        }

        // Handle email verification
        if (verifyToken) {
            authAPI.verifyEmail(verifyToken)
                .then((result) => {
                    login(result.token, result.user.email);
                    router.push('/my-rooms');
                })
                .catch((err) => {
                    setError(err instanceof Error ? err.message : 'Verification failed');
                });
            return;
        }

        if (token) {
            // OAuth or Magic Link callback - store token and redirect
            login(token, userEmail || '');
            router.push('/my-rooms');
        }
    }, [searchParams, login, router]);

    const handleGoogleLogin = async () => {
        try {
            const { auth_url } = await authAPI.getGoogleAuthUrl();
            window.location.href = auth_url;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to connect to Google');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            if (mode === 'signup') {
                if (password !== confirmPassword) {
                    setError('Passwords do not match');
                    setIsLoading(false);
                    return;
                }
                const result = await authAPI.signUp(email, password);
                if (result.token) {
                    login(result.token, email);
                    router.push('/my-rooms');
                } else {
                    setSuccess(result.message || 'Account created! Please check your email.');
                }
            } else {
                const result = await authAPI.signIn(email, password);
                if (result.requires_2fa) {
                    // Handle 2FA
                    setError('2FA not implemented yet');
                } else {
                    login(result.token, result.user.email);
                    router.push('/my-rooms');
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

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
                    <h1 className="text-2xl font-medium text-white text-center mb-2">
                        {mode === 'signin' ? 'Welcome back' : 'Create account'}
                    </h1>
                    <p className="text-neutral-400 text-sm text-center mb-8">
                        {mode === 'signin' ? 'Sign in to continue' : 'Get started with Zorem'}
                    </p>

                    {/* Toggle */}
                    <div className="flex gap-2 p-1 rounded-xl bg-white/5 mb-6">
                        <button
                            onClick={() => setMode('signin')}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                                mode === 'signin' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
                            }`}
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => setMode('signup')}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                                mode === 'signup' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
                            }`}
                        >
                            Sign Up
                        </button>
                    </div>

                    {/* Google OAuth Button */}
                    <button
                        onClick={handleGoogleLogin}
                        className="w-full h-12 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-medium flex items-center justify-center gap-3 transition-all mb-6"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Continue with Google
                    </button>

                    <div className="relative mb-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/10"></div>
                        </div>
                        <div className="relative flex justify-center text-xs">
                            <span className="px-2 bg-[#0a0a0a] text-neutral-500">or continue with email</span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input
                            label="Email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                        />
                        <Input
                            label="Password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                        {mode === 'signup' && (
                            <Input
                                label="Confirm Password"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                            />
                        )}

                        {error && <p className="text-red-400 text-sm">{error}</p>}
                        {success && <p className="text-emerald-400 text-sm">{success}</p>}

                        <Button type="submit" disabled={isLoading} className="w-full">
                            {isLoading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
                        </Button>
                    </form>
                </div>

                <p className="text-center text-neutral-500 text-xs mt-6">
                    <Link href="/" className="hover:text-white transition-colors">← Back to home</Link>
                </p>
            </div>
        </div>
    );
}

export default function AuthPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <div className="text-neutral-400">Loading...</div>
            </div>
        }>
            <AuthForm />
        </Suspense>
    );
}
