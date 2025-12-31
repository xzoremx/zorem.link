// ============================================================================
// Database Models
// ============================================================================

export interface User {
  id: string;
  email: string;
  password_hash: string | null;
  google_id: string | null;
  email_verified: boolean;
  email_verification_token: string | null;
  email_verification_expires: Date | null;
  two_factor_enabled: boolean;
  two_factor_secret: string | null;
  created_at: Date;
}

export interface Room {
  id: string;
  owner_id: string;
  code: string;
  expires_at: Date;
  allow_uploads: boolean;
  is_active: boolean;
  created_at: Date;
}

export interface Story {
  id: string;
  room_id: string;
  media_type: 'image' | 'video';
  media_key: string;
  created_at: Date;
  expires_at: Date;
}

export interface ViewerSession {
  id: string;
  room_id: string;
  viewer_hash: string;
  nickname: string;
  created_at: Date;
}

export interface View {
  id: string;
  story_id: string;
  viewer_hash: string;
  viewed_at: Date;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export type RoomDuration = '24h' | '72h' | '7d';

export interface CreateRoomRequest {
  duration: RoomDuration;
  allow_uploads?: boolean;
}

export interface CreateRoomResponse {
  room_id: string;
  code: string;
  link: string;
  qr_data: string | null;
  expires_at: Date;
  allow_uploads: boolean;
  duration: RoomDuration;
}

export interface ValidateCodeResponse {
  valid: boolean;
  room_id?: string;
  code?: string;
  expires_at?: Date;
  allow_uploads?: boolean;
  error?: string;
}

export interface JoinRoomRequest {
  code: string;
  nickname: string;
}

export interface JoinRoomResponse {
  viewer_hash: string;
  room_id: string;
  room_code: string;
  allow_uploads: boolean;
  expires_at: Date;
  nickname: string;
}

export interface UploadUrlRequest {
  room_id: string;
  media_type: 'image' | 'video';
  file_size?: number;
  content_type?: string;
  viewer_hash?: string;
}

export interface UploadUrlResponse {
  upload_url: string;
  media_key: string;
  expires_in: number;
  room_expires_at: Date;
}

export interface CreateStoryRequest {
  room_id: string;
  media_key: string;
  media_type: 'image' | 'video';
  viewer_hash?: string;
}

export interface StoryResponse {
  id: string;
  media_type: 'image' | 'video';
  media_url: string | null;
  media_key: string;
  created_at: Date;
  expires_at: Date;
  view_count: number;
  viewed: boolean;
}

export interface StoriesListResponse {
  room_id: string;
  allow_uploads: boolean;
  stories: StoryResponse[];
  total: number;
}

// ============================================================================
// Auth Types
// ============================================================================

export interface JWTPayload {
  userId: string;
  type?: string;
  email?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface MagicLinkRequest {
  email: string;
}

export interface SignUpRequest {
  email: string;
  password: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface Verify2FARequest {
  temp_token: string;
  code: string;
}

// ============================================================================
// Config Types
// ============================================================================

export interface AppConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  jwtSecret: string;
  magicLinkExpiry: number;
  resendApiKey: string | undefined;
  resendFromEmail: string | undefined;
  googleClientId: string | undefined;
  googleClientSecret: string | undefined;
  googleRedirectUri: string | undefined;
  storageType: string;
  awsAccessKeyId: string | undefined;
  awsSecretAccessKey: string | undefined;
  awsRegion: string;
  s3BucketName: string | undefined;
  r2AccountId: string | undefined;
  r2Endpoint: string | undefined;
  frontendUrl: string;
  corsOrigin: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

export interface ContentTypeInfo {
  contentType: string;
  fileExtension: string;
}

export type MediaType = 'image' | 'video';

// ============================================================================
// Error Types
// ============================================================================

export interface APIError {
  error: string;
  stack?: string;
  details?: unknown;
}

export class HttpError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'HttpError';
  }
}
