/**
 * Auth Context - Secure authentication state management
 */

import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    type ReactNode,
} from 'react';
import { authAPI, storage } from '@/lib/api';
import type { User } from '@/types';

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (token: string, email?: string) => void;
    logout: () => void;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const login = useCallback((token: string, email?: string) => {
        storage.setAuthToken(token);
        if (email) {
            storage.setAuthEmail(email);
        }
        // Trigger user refresh
        refreshUser();
    }, []);

    const logout = useCallback(() => {
        storage.clearAuthToken();
        setUser(null);
    }, []);

    const refreshUser = useCallback(async () => {
        const token = storage.getAuthToken();

        if (!token) {
            setUser(null);
            setIsLoading(false);
            return;
        }

        try {
            const userData = await authAPI.getMe();
            setUser(userData);

            // Cache email
            if (userData.email) {
                storage.setAuthEmail(userData.email);
            }
        } catch (error) {
            // Token is invalid, clear it
            console.warn('Auth token invalid:', error);
            storage.clearAuthToken();
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Check auth on mount
    useEffect(() => {
        refreshUser();
    }, [refreshUser]);

    const value: AuthContextType = {
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context
 * @throws if used outside AuthProvider
 */
export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);

    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }

    return context;
}
