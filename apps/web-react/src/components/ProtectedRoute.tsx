/**
 * ProtectedRoute - Requires authentication to access
 * Redirects to auth page if not authenticated
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    // Show nothing while checking auth status
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-neutral-400">Loading...</div>
            </div>
        );
    }

    // Redirect to auth if not authenticated
    if (!isAuthenticated) {
        // Save the attempted URL for redirecting after login
        return <Navigate to="/auth" state={{ from: location }} replace />;
    }

    return <>{children}</>;
}
