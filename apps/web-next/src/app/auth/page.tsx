'use client';

import { useState, Suspense } from 'react';
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
