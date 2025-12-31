/**
 * Type definitions for Zorem API
 */

// Auth Types
export interface User {
    id: string;
    email: string;
    created_at?: string;
    two_factor_enabled?: boolean;
}

export interface AuthResponse {
    token: string;
    user: User;
}

export interface SignInResponse extends AuthResponse {
    requires_2fa?: boolean;
    temp_token?: string;
}

export interface SignUpResponse {
    message: string;
    requires_verification?: boolean;
    verification_link?: string;
    token?: string;
}

export interface MagicLinkResponse {
    message: string;
    magic_link?: string;
    token?: string;
}

// Room Types
export interface Room {
    id: string;
    code: string;
    creator_id: string;
    duration: string;
    allow_uploads: boolean;
    expires_at: string;
    created_at: string;
    qr_data?: string;
}

export interface CreateRoomResponse {
    room_id: string;
    code: string;
    qr_data: string;
    expires_at: string;
}

// Story Types
export interface Story {
    id: string;
    room_id: string;
    media_url: string;
    media_type: 'image' | 'video';
    created_at: string;
    creator_nickname?: string;
}

export interface UploadUrlResponse {
    upload_url: string;
    media_key: string;
}

// Viewer Types
export interface ViewerSession {
    viewer_hash: string;
    room_id: string;
    nickname: string;
}

export interface JoinRoomResponse {
    viewer_hash: string;
    room: Room;
}

// API Error
export interface ApiError {
    error: string;
    message?: string;
}
