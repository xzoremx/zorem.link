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
    const [rememberMe, setRememberMe] = useState(false);
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [showMagicLink, setShowMagicLink] = useState(false);
    const [magicLinkEmail, setMagicLinkEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // 2FA state
    const [show2FA, setShow2FA] = useState(false);
    const [tempToken, setTempToken] = useState('');
    const [twoFactorCode, setTwoFactorCode] = useState('');

    // Handle OAuth callback (token in URL)
    useEffect(() => {
        const handleCallback = async () => {
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
                try {
                    const result = await authAPI.verifyEmail(verifyToken);
                    await login(result.token, result.user.email);
                    router.push('/my-rooms');
                } catch (err) {
                    setError(err instanceof Error ? err.message : 'Verification failed');
                }
                return;
            }

            if (token) {
                // OAuth or Magic Link callback - store token and redirect
                await login(token, userEmail || '');
                router.push('/my-rooms');
            }
        };

        handleCallback();
    }, [searchParams, login, router]);

    const handleGoogleLogin = async () => {
        try {
            const { auth_url } = await authAPI.getGoogleAuthUrl();
            window.location.href = auth_url;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to connect to Google');
        }
    };

    const handleMagicLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!magicLinkEmail) {
            setError('Please enter your email');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const result = await authAPI.requestMagicLink(magicLinkEmail);
            if (result.magic_link) {
                setSuccess(`Magic link sent! Check your email or click here: ${result.magic_link}`);
            } else {
                setSuccess('If an account exists with this email, a magic link has been sent.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send magic link');
        } finally {
            setIsLoading(false);
        }
    };

    const handle2FASubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (twoFactorCode.length !== 6) {
            setError('Please enter a valid 6-digit code');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const result = await authAPI.verify2FA(tempToken, twoFactorCode);
            await login(result.token, result.user.email);
            router.push('/my-rooms');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Invalid 2FA code');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            if (mode === 'signup') {
                if (!acceptTerms) {
                    setError('Please accept the Terms of Service and Privacy Policy');
                    setIsLoading(false);
                    return;
                }
                if (password !== confirmPassword) {
                    setError('Passwords do not match');
                    setIsLoading(false);
                    return;
                }
                if (password.length < 8) {
                    setError('Password must be at least 8 characters');
                    setIsLoading(false);
                    return;
                }
                const result = await authAPI.signUp(email, password);
                if (result.token) {
                    await login(result.token, email);
                    router.push('/my-rooms');
                } else {
                    setSuccess(result.message || 'Account created! Please check your email.');
                }
            } else {
                const result = await authAPI.signIn(email, password);
                if (result.requires_2fa) {
                    // Show 2FA modal
                    setTempToken(result.temp_token || '');
                    setShow2FA(true);
                } else {
                    await login(result.token, result.user.email);
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

            {/* 2FA Modal */}
            {show2FA && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="glass rounded-2xl p-8 w-full max-w-sm animate-fade-up">
                        <h2 className="text-xl font-medium text-white text-center mb-2">Two-Factor Authentication</h2>
                        <p className="text-neutral-400 text-sm text-center mb-6">
                            Enter the 6-digit code from your authenticator app
                        </p>
                        <form onSubmit={handle2FASubmit} className="space-y-4">
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                value={twoFactorCode}
                                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                                placeholder="000000"
                                className="w-full h-14 px-6 rounded-xl bg-white/5 border border-white/10 text-2xl font-mono text-center text-white placeholder:text-neutral-600 outline-none transition-all focus:border-white/20"
                                autoFocus
                            />
                            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                            <Button type="submit" disabled={isLoading || twoFactorCode.length !== 6} className="w-full">
                                {isLoading ? 'Verifying...' : 'Verify'}
                            </Button>
                            <button
                                type="button"
                                onClick={() => { setShow2FA(false); setTwoFactorCode(''); setError(''); }}
                                className="w-full text-sm text-neutral-500 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                        </form>
                    </div>
                </div>
            )}

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
                            onClick={() => { setMode('signin'); setShowMagicLink(false); }}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'signin' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
                                }`}
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => { setMode('signup'); setShowMagicLink(false); }}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'signup' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
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
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
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

                    {/* Magic Link Form */}
                    {showMagicLink ? (
                        <form onSubmit={handleMagicLink} className="space-y-4">
                            <Input
                                label="Email"
                                type="email"
                                value={magicLinkEmail}
                                onChange={(e) => setMagicLinkEmail(e.target.value)}
                                placeholder="you@example.com"
                                required
                            />
                            {error && <p className="text-red-400 text-sm">{error}</p>}
                            {success && <p className="text-emerald-400 text-sm">{success}</p>}
                            <Button type="submit" disabled={isLoading} className="w-full">
                                {isLoading ? 'Sending...' : 'Send Magic Link'}
                            </Button>
                            <button
                                type="button"
                                onClick={() => setShowMagicLink(false)}
                                className="w-full text-sm text-neutral-500 hover:text-white transition-colors"
                            >
                                Back to password login
                            </button>
                        </form>
                    ) : (
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

                            {/* Sign In extras: Remember Me & Forgot Password */}
                            {mode === 'signin' && (
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={rememberMe}
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                            className="w-4 h-4 rounded border-white/20 bg-white/5 accent-violet-500"
                                        />
                                        <span className="text-xs text-neutral-400">Remember me</span>
                                    </label>
                                    <button
                                        type="button"
                                        className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                                        onClick={() => setError('Password reset coming soon!')}
                                    >
                                        Forgot password?
                                    </button>
                                </div>
                            )}

                            {/* Sign Up extras: Accept Terms */}
                            {mode === 'signup' && (
                                <label className="flex items-start gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={acceptTerms}
                                        onChange={(e) => setAcceptTerms(e.target.checked)}
                                        className="w-4 h-4 rounded border-white/20 bg-white/5 mt-0.5 accent-violet-500"
                                    />
                                    <span className="text-xs text-neutral-400">
                                        I agree to the{' '}
                                        <a href="#" className="text-violet-400 hover:text-violet-300">Terms of Service</a>
                                        {' '}and{' '}
                                        <a href="#" className="text-violet-400 hover:text-violet-300">Privacy Policy</a>
                                    </span>
                                </label>
                            )}

                            {error && <p className="text-red-400 text-sm">{error}</p>}
                            {success && <p className="text-emerald-400 text-sm">{success}</p>}

                            <Button type="submit" disabled={isLoading} className="w-full">
                                {isLoading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
                            </Button>
                        </form>
                    )}

                    {/* Magic Link Toggle */}
                    {!showMagicLink && mode === 'signin' && (
                        <div className="mt-6 pt-6 border-t border-white/10">
                            <button
                                onClick={() => setShowMagicLink(true)}
                                className="w-full text-xs text-neutral-500 hover:text-white transition-colors"
                            >
                                Or use magic link instead
                            </button>
                        </div>
                    )}
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
