/**
 * AuthPage - Handles all authentication flows
 * Sign In, Sign Up, Magic Link, OAuth, 2FA, Email Verification
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import * as Tabs from '@radix-ui/react-tabs';
import { useAuth } from '@/context';
import { authAPI } from '@/lib';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { cn } from '@/lib/utils';

export function AuthPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { isAuthenticated, login } = useAuth();

    // Form states
    const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
    const [showMagicLink, setShowMagicLink] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Sign In form
    const [signInEmail, setSignInEmail] = useState('');
    const [signInPassword, setSignInPassword] = useState('');

    // Sign Up form
    const [signUpEmail, setSignUpEmail] = useState('');
    const [signUpPassword, setSignUpPassword] = useState('');
    const [signUpPasswordConfirm, setSignUpPasswordConfirm] = useState('');

    // Magic Link form
    const [magicLinkEmail, setMagicLinkEmail] = useState('');

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated) {
            navigate('/create-room', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    // Handle URL parameters (magic link, email verification, OAuth)
    useEffect(() => {
        const token = searchParams.get('token');
        const verifyToken = searchParams.get('verify');
        const oauthToken = searchParams.get('oauth_token');
        const oauthError = searchParams.get('oauth_error');
        const mode = searchParams.get('mode');

        if (mode === 'signup') {
            setActiveTab('signup');
        }

        if (oauthError) {
            setError('Google sign in failed. Please try again.');
        } else if (verifyToken) {
            handleEmailVerification(verifyToken);
        } else if (token) {
            handleMagicLinkVerification(token);
        } else if (oauthToken) {
            handleOAuthCallback(oauthToken);
        }
    }, [searchParams]);

    async function handleMagicLinkVerification(token: string) {
        setIsLoading(true);
        try {
            const result = await authAPI.verifyMagicLink(token);
            login(result.token, result.user?.email);
            navigate('/create-room', { replace: true });
        } catch {
            setError('Invalid or expired magic link');
        } finally {
            setIsLoading(false);
        }
    }

    async function handleEmailVerification(token: string) {
        setIsLoading(true);
        try {
            const result = await authAPI.verifyEmail(token);
            login(result.token, result.user?.email);
            setSuccess('Email verified successfully! Redirecting...');
            setTimeout(() => navigate('/create-room', { replace: true }), 1500);
        } catch {
            setError('Invalid or expired verification link');
        } finally {
            setIsLoading(false);
        }
    }

    function handleOAuthCallback(token: string) {
        login(token);
        navigate('/create-room', { replace: true });
    }

    async function handleSignIn(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const result = await authAPI.signIn(signInEmail.trim(), signInPassword);

            if (result.requires_2fa && result.temp_token) {
                const code = prompt('Enter the 6-digit code from your authenticator app:');
                if (code?.length === 6) {
                    const twoFaResult = await authAPI.verify2FA(result.temp_token, code);
                    login(twoFaResult.token, twoFaResult.user?.email);
                    navigate('/create-room', { replace: true });
                }
            } else if (result.token) {
                login(result.token, result.user?.email);
                navigate('/create-room', { replace: true });
            }
        } catch (err) {
            setError((err as Error).message || 'Failed to sign in');
        } finally {
            setIsLoading(false);
        }
    }

    async function handleSignUp(e: React.FormEvent) {
        e.preventDefault();
        setError('');

        if (signUpPassword !== signUpPasswordConfirm) {
            setError('Passwords do not match');
            return;
        }

        if (signUpPassword.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setIsLoading(true);

        try {
            const result = await authAPI.signUp(signUpEmail.trim(), signUpPassword);

            if (result.requires_verification) {
                if (result.verification_link) {
                    // Development mode
                    setSuccess(`Account created! Check your email or click the link we sent.`);
                    if (result.token) {
                        setTimeout(() => {
                            login(result.token as string);
                            navigate('/create-room', { replace: true });
                        }, 2000);
                    }
                } else {
                    setSuccess('Account created! Please check your email to verify your account.');
                }
            } else if (result.token) {
                login(result.token);
                navigate('/create-room', { replace: true });
            }
        } catch (err) {
            setError((err as Error).message || 'Failed to create account');
        } finally {
            setIsLoading(false);
        }
    }

    async function handleMagicLink(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const result = await authAPI.requestMagicLink(magicLinkEmail.trim());

            if (result.magic_link) {
                setSuccess('Magic link sent! Check your email or click the link we sent.');
                if (result.token) {
                    setTimeout(() => handleMagicLinkVerification(result.token as string), 1000);
                }
            } else {
                setSuccess('If an account exists with this email, a magic link has been sent.');
            }
        } catch (err) {
            setError((err as Error).message || 'Failed to send magic link');
        } finally {
            setIsLoading(false);
        }
    }

    async function handleGoogleAuth() {
        try {
            const result = await authAPI.getGoogleAuthUrl();
            if (result.auth_url) {
                window.location.href = result.auth_url;
            }
        } catch {
            setError('Failed to initiate Google sign in');
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            {/* Background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[80%] h-[600px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-violet-900/20 via-background to-background blur-[100px] opacity-50" />
            </div>

            <div className="relative z-10 w-full max-w-md animate-fade-up">
                {/* Logo */}
                <div className="flex items-center justify-center mb-8">
                    <img src="/logo.png" alt="Zorem" className="w-12 h-12 object-contain" />
                </div>

                <Card>
                    <CardHeader className="text-center">
                        <CardTitle>
                            {activeTab === 'signin' ? 'Sign In' : 'Sign Up'}
                        </CardTitle>
                        <CardDescription>
                            {activeTab === 'signin' ? 'Welcome back to Zorem' : 'Create your Zorem account'}
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        {/* Tabs */}
                        <Tabs.Root value={activeTab} onValueChange={(v) => setActiveTab(v as 'signin' | 'signup')}>
                            <Tabs.List className="flex gap-2 mb-6 bg-white/5 rounded-xl p-1">
                                <Tabs.Trigger
                                    value="signin"
                                    className={cn(
                                        'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
                                        activeTab === 'signin' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
                                    )}
                                >
                                    Sign In
                                </Tabs.Trigger>
                                <Tabs.Trigger
                                    value="signup"
                                    className={cn(
                                        'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
                                        activeTab === 'signup' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
                                    )}
                                >
                                    Sign Up
                                </Tabs.Trigger>
                            </Tabs.List>

                            {/* Google OAuth */}
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full mb-4"
                                onClick={handleGoogleAuth}
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                Continue with Google
                            </Button>

                            <div className="flex items-center gap-4 mb-6">
                                <div className="flex-1 h-px bg-white/10" />
                                <span className="text-xs text-neutral-500">or</span>
                                <div className="flex-1 h-px bg-white/10" />
                            </div>

                            {/* Sign In Content */}
                            <Tabs.Content value="signin">
                                {!showMagicLink ? (
                                    <form onSubmit={handleSignIn} className="space-y-4">
                                        <Input
                                            type="email"
                                            label="Email"
                                            placeholder="your@email.com"
                                            value={signInEmail}
                                            onChange={(e) => setSignInEmail(e.target.value)}
                                            required
                                            autoFocus
                                        />
                                        <Input
                                            type="password"
                                            label="Password"
                                            placeholder="••••••••"
                                            value={signInPassword}
                                            onChange={(e) => setSignInPassword(e.target.value)}
                                            required
                                        />

                                        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                                        {success && <p className="text-green-400 text-sm text-center">{success}</p>}

                                        <Button type="submit" className="w-full" disabled={isLoading}>
                                            {isLoading ? 'Signing in...' : 'Sign In'}
                                        </Button>
                                    </form>
                                ) : (
                                    <form onSubmit={handleMagicLink} className="space-y-4">
                                        <Input
                                            type="email"
                                            label="Email"
                                            placeholder="your@email.com"
                                            value={magicLinkEmail}
                                            onChange={(e) => setMagicLinkEmail(e.target.value)}
                                            required
                                        />

                                        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                                        {success && <p className="text-green-400 text-sm text-center">{success}</p>}

                                        <Button type="submit" variant="outline" className="w-full" disabled={isLoading}>
                                            {isLoading ? 'Sending...' : 'Send Magic Link'}
                                        </Button>
                                    </form>
                                )}
                            </Tabs.Content>

                            {/* Sign Up Content */}
                            <Tabs.Content value="signup">
                                <form onSubmit={handleSignUp} className="space-y-4">
                                    <Input
                                        type="email"
                                        label="Email"
                                        placeholder="your@email.com"
                                        value={signUpEmail}
                                        onChange={(e) => setSignUpEmail(e.target.value)}
                                        required
                                    />
                                    <Input
                                        type="password"
                                        label="Password"
                                        placeholder="At least 8 characters"
                                        value={signUpPassword}
                                        onChange={(e) => setSignUpPassword(e.target.value)}
                                        required
                                        minLength={8}
                                    />
                                    <Input
                                        type="password"
                                        label="Confirm Password"
                                        placeholder="Confirm your password"
                                        value={signUpPasswordConfirm}
                                        onChange={(e) => setSignUpPasswordConfirm(e.target.value)}
                                        required
                                    />

                                    {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                                    {success && <p className="text-green-400 text-sm text-center">{success}</p>}

                                    <Button type="submit" className="w-full" disabled={isLoading}>
                                        {isLoading ? 'Creating account...' : 'Create Account'}
                                    </Button>
                                </form>
                            </Tabs.Content>
                        </Tabs.Root>

                        {/* Magic Link Toggle */}
                        <div className="mt-6 pt-6 border-t border-white/10">
                            <button
                                type="button"
                                onClick={() => setShowMagicLink(!showMagicLink)}
                                className="w-full text-xs text-neutral-500 hover:text-white transition-colors"
                            >
                                {showMagicLink ? 'Use password instead' : 'Or use magic link instead'}
                            </button>
                        </div>

                        <div className="mt-6 text-center">
                            <Link to="/" className="text-xs text-neutral-500 hover:text-white transition-colors">
                                Back to home
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
