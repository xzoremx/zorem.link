/**
 * Typed API Client for Zorem
 * Secure, type-safe HTTP client for all API calls
 */

import type {
    User,
    AuthResponse,
    SignInResponse,
    SignUpResponse,
    MagicLinkResponse,
    Room,
    RoomsListResponse,
    CreateRoomResponse,
    Story,
    UploadUrlResponse,
    JoinRoomResponse,
    ViewerListItem,
} from '@/types';

// Get API URL from environment
function getApiBaseUrl(): string {
    // Next.js exposes public env variables with NEXT_PUBLIC_ prefix
    if (process.env.NEXT_PUBLIC_API_URL) {
        return process.env.NEXT_PUBLIC_API_URL;
    }

    // Client-side auto-detect based on hostname
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;

        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:3000';
        }

        // Production: assume API is on api subdomain
        const baseDomain = hostname.startsWith('www.') ? hostname.slice(4) : hostname;
        return `https://api.${baseDomain}`;
    }

    // Server-side fallback
    return 'http://localhost:3000';
}

export const API_BASE_URL = getApiBaseUrl();

/**
 * Storage utilities with type safety
 * Note: Only use on client-side
 */
export const storage = {
    getAuthToken: (): string | null => {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem('auth_token');
    },
    setAuthToken: (token: string): void => {
        if (typeof window === 'undefined') return;
        localStorage.setItem('auth_token', token);
    },
    clearAuthToken: (): void => {
        if (typeof window === 'undefined') return;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_email');
    },

    getAuthEmail: (): string | null => {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem('auth_email');
    },
    setAuthEmail: (email: string): void => {
        if (typeof window === 'undefined') return;
        localStorage.setItem('auth_email', email);
    },

    getViewerHash: (): string | null => {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem('viewer_hash');
    },
    setViewerHash: (hash: string): void => {
        if (typeof window === 'undefined') return;
        localStorage.setItem('viewer_hash', hash);
    },

    getRoomId: (): string | null => {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem('current_room_id');
    },
    setRoomId: (id: string): void => {
        if (typeof window === 'undefined') return;
        localStorage.setItem('current_room_id', id);
    },

    getRoomCode: (): string | null => {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem('current_room_code');
    },
    setRoomCode: (code: string): void => {
        if (typeof window === 'undefined') return;
        localStorage.setItem('current_room_code', code);
    },

    clearSession: (): void => {
        if (typeof window === 'undefined') return;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_email');
        localStorage.removeItem('viewer_hash');
        localStorage.removeItem('current_room_id');
        localStorage.removeItem('current_room_code');
    },
};

/**
 * Base API request function with error handling
 */
async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    // Add auth token if exists (client-side only)
    const token = storage.getAuthToken();
    if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    // Add viewer hash if exists
    const viewerHash = storage.getViewerHash();
    if (viewerHash) {
        (headers as Record<string, string>)['x-viewer-hash'] = viewerHash;
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers,
        });

        const contentType = response.headers.get('content-type');

        if (!contentType?.includes('application/json')) {
            const text = await response.text();
            throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`);
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `HTTP error ${response.status}`);
        }

        return data as T;
    } catch (error) {
        const err = error as Error;

        // Check for connection errors
        if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
            throw new Error('Cannot connect to server. Please check your connection.');
        }

        throw error;
    }
}

/**
 * Auth API
 */
export const authAPI = {
    requestMagicLink: (email: string): Promise<MagicLinkResponse> =>
        apiRequest('/api/auth/request-magic-link', {
            method: 'POST',
            body: JSON.stringify({ email }),
        }),

    verifyMagicLink: (token: string): Promise<AuthResponse> =>
        apiRequest(`/api/auth/verify-magic-link?token=${encodeURIComponent(token)}`),

    signIn: (email: string, password: string): Promise<SignInResponse> =>
        apiRequest('/api/auth/sign-in', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        }),

    signUp: (email: string, password: string): Promise<SignUpResponse> =>
        apiRequest('/api/auth/sign-up', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        }),

    getGoogleAuthUrl: (): Promise<{ auth_url: string }> =>
        apiRequest('/api/auth/google/url'),

    verifyEmail: (token: string): Promise<AuthResponse> =>
        apiRequest(`/api/auth/verify-email?token=${encodeURIComponent(token)}`),

    verify2FA: (tempToken: string, code: string): Promise<AuthResponse> =>
        apiRequest('/api/auth/verify-2fa', {
            method: 'POST',
            body: JSON.stringify({ temp_token: tempToken, code }),
        }),

    setup2FA: (): Promise<{ secret: string; qr_code: string }> =>
        apiRequest('/api/auth/2fa/setup', { method: 'POST' }),

    enable2FA: (code: string): Promise<{ message: string }> =>
        apiRequest('/api/auth/2fa/enable', {
            method: 'POST',
            body: JSON.stringify({ code }),
        }),

    disable2FA: (code: string): Promise<{ message: string }> =>
        apiRequest('/api/auth/2fa/disable', {
            method: 'POST',
            body: JSON.stringify({ code }),
        }),

    getMe: (): Promise<User> =>
        apiRequest('/api/auth/me'),
};

/**
 * Rooms API
 */
export const roomsAPI = {
    create: (duration: string, allowUploads: boolean, maxUploadsPerViewer?: number): Promise<CreateRoomResponse> => {
        const body: Record<string, unknown> = {
            duration,
            allow_uploads: allowUploads,
        };
        if (maxUploadsPerViewer !== undefined) {
            body.max_uploads_per_viewer = maxUploadsPerViewer;
        }
        return apiRequest('/api/rooms', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    },

    validateCode: async (code: string): Promise<{ valid: boolean; error?: string; room?: Room }> => {
        try {
            const room = await apiRequest<Room>(`/api/rooms/${encodeURIComponent(code)}`);
            return { valid: true, room };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Invalid room code';
            return { valid: false, error: message };
        }
    },

    getByCode: (code: string): Promise<Room> =>
        apiRequest(`/api/rooms/${encodeURIComponent(code)}`),

    getDetails: (roomId: string): Promise<Room> =>
        apiRequest(`/api/rooms/id/${encodeURIComponent(roomId)}`),

    list: (): Promise<RoomsListResponse> =>
        apiRequest('/api/rooms'),

    close: (roomId: string): Promise<{ message: string }> =>
        apiRequest(`/api/rooms/${encodeURIComponent(roomId)}`, {
            method: 'DELETE',
        }),

    getViewers: (roomId: string): Promise<{ viewers: ViewerListItem[]; total: number }> =>
        apiRequest(`/api/rooms/${encodeURIComponent(roomId)}/viewers`),
};

/**
 * Viewer API
 */
export const viewerAPI = {
    join: (code: string, nickname: string, avatar?: string): Promise<JoinRoomResponse> =>
        apiRequest('/api/viewer/join', {
            method: 'POST',
            body: JSON.stringify({ code, nickname, avatar }),
        }),

    getSession: (viewerHash: string): Promise<{ room: Room; nickname: string; avatar: string }> =>
        apiRequest(`/api/viewer/session?viewer_hash=${encodeURIComponent(viewerHash)}`),
};

/**
 * Stories API
 */
export const storiesAPI = {
    getStories: (roomId: string, viewerHash?: string): Promise<{ stories: Story[] }> => {
        const url = viewerHash
            ? `/api/stories/room/${roomId}?viewer_hash=${encodeURIComponent(viewerHash)}`
            : `/api/stories/room/${roomId}`;
        return apiRequest(url, { cache: 'no-store' });
    },

    getUploadUrl: (
        roomId: string,
        mediaType: 'image' | 'video',
        fileSize: number,
        contentType?: string
    ): Promise<UploadUrlResponse> => {
        const body: Record<string, unknown> = {
            room_id: roomId,
            media_type: mediaType,
            file_size: fileSize,
        };

        if (contentType) {
            body.content_type = contentType;
        }

        const viewerHash = storage.getViewerHash();
        if (viewerHash) {
            body.viewer_hash = viewerHash;
        }

        return apiRequest('/api/stories/upload-url', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    },

    create: (
        roomId: string,
        mediaKey: string,
        mediaType: 'image' | 'video'
    ): Promise<Story> => {
        const body: Record<string, unknown> = {
            room_id: roomId,
            media_key: mediaKey,
            media_type: mediaType,
        };

        const viewerHash = storage.getViewerHash();
        if (viewerHash) {
            body.viewer_hash = viewerHash;
        }

        return apiRequest('/api/stories', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    },

    recordView: (storyId: string, viewerHash: string): Promise<{ message: string }> =>
        apiRequest(`/api/stories/${storyId}/view`, {
            method: 'POST',
            body: JSON.stringify({ viewer_hash: viewerHash }),
        }),

    toggleLike: (storyId: string, viewerHash: string): Promise<{ story_id: string; liked: boolean; like_count: number }> =>
        apiRequest(`/api/stories/${storyId}/like`, {
            method: 'POST',
            body: JSON.stringify({ viewer_hash: viewerHash }),
        }),

    delete: (storyId: string): Promise<{ message: string; story_id: string }> =>
        apiRequest(`/api/stories/${storyId}`, {
            method: 'DELETE',
        }),
};

/**
 * Emojis API
 */
export const emojisAPI = {
    getTrending: (): Promise<{ trending: string[]; total: number; updated_at: string }> =>
        apiRequest('/api/emojis/trending'),
};

/**
 * Upload file directly to S3/R2
 */
export async function uploadToStorage(
    uploadUrl: string,
    file: File
): Promise<void> {
    const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
            'Content-Type': file.type,
        },
    });

    if (!response.ok) {
        const text = await response.text();
        const codeMatch = text.match(/<Code>([^<]+)<\/Code>/);
        const error = codeMatch ? codeMatch[1] : `Upload failed (${response.status})`;
        throw new Error(error);
    }
}

/**
 * Unified API object for cleaner imports
 */
export const api = {
    auth: authAPI,
    rooms: roomsAPI,
    viewer: viewerAPI,
    stories: storiesAPI,
    emojis: emojisAPI,
    storage,
    uploadToStorage,
};
