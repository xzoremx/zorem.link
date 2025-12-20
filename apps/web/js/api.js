/**
 * API Client para Zorem
 * Cliente base para todas las llamadas a la API
 */

import { config as appConfig } from './config.js';

const API_BASE_URL = appConfig.apiBaseUrl;

/**
 * Función base para hacer requests a la API
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  // Agregar token de autenticación si existe
  const token = localStorage.getItem('auth_token');
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  // Agregar viewer_hash si existe
  const viewerHash = localStorage.getItem('viewer_hash');
  if (viewerHash) {
    defaultHeaders['x-viewer-hash'] = viewerHash;
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    console.log(`[API] Making request to: ${url}`, config);
    const response = await fetch(url, config);
    console.log(`[API] Response status: ${response.status}`, response);
    
    // Check if response is JSON before parsing
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`);
    }

    if (!response.ok) {
      // Don't treat HTTP errors as connection errors
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('[API] Request Error Details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      url: url
    });
    
    // Only treat as connection error if we didn't get a response at all
    // If we got a response (even if it's an error), it's not a connection issue
    const errorMsg = error.message || String(error);
    const errorName = error.name || '';
    
    // More specific detection of connection errors
    // Only if we truly couldn't reach the server (no response received)
    const isConnectionError = 
      (errorName === 'TypeError' && errorMsg.includes('Failed to fetch')) ||
      errorMsg.includes('ERR_CONNECTION_REFUSED') ||
      errorMsg.includes('ERR_INTERNET_DISCONNECTED') ||
      errorMsg.includes('ERR_NETWORK_CHANGED') ||
      (errorMsg.includes('NetworkError') && !errorMsg.includes('HTTP'));
    
    if (isConnectionError) {
      throw new Error('No se puede conectar al servidor. Por favor, verifica que el servidor de la API esté corriendo en http://localhost:3000');
    }
    
    // Re-throw the original error for other cases (including HTTP errors like 401, 500, etc.)
    throw error;
  }
}

/**
 * Auth API
 */
export const authAPI = {
  async requestMagicLink(email) {
    return apiRequest('/api/auth/request-magic-link', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async verifyMagicLink(token) {
    return apiRequest(`/api/auth/verify-magic-link?token=${token}`, {
      method: 'GET',
    });
  },

  async signIn(email, password) {
    return apiRequest('/api/auth/sign-in', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async signUp(email, password) {
    return apiRequest('/api/auth/sign-up', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async getGoogleAuthUrl() {
    return apiRequest('/api/auth/google/url', {
      method: 'GET',
    });
  },

  async verifyEmail(token) {
    return apiRequest(`/api/auth/verify-email?token=${token}`, {
      method: 'GET',
    });
  },

  async verify2FA(tempToken, code) {
    return apiRequest('/api/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({ temp_token: tempToken, code }),
    });
  },

  async setup2FA() {
    return apiRequest('/api/auth/2fa/setup', {
      method: 'POST',
    });
  },

  async enable2FA(code) {
    return apiRequest('/api/auth/2fa/enable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  async disable2FA(code) {
    return apiRequest('/api/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  async getMe() {
    return apiRequest('/api/auth/me', {
      method: 'GET',
    });
  },
};

/**
 * Rooms API
 */
export const roomsAPI = {
  async createRoom(duration, allowUploads) {
    return apiRequest('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({ duration, allow_uploads: allowUploads }),
    });
  },

  async validateCode(code) {
    return apiRequest(`/api/rooms/${code}`, {
      method: 'GET',
    });
  },

  async getRoomDetails(roomId) {
    return apiRequest(`/api/rooms/id/${roomId}`, {
      method: 'GET',
    });
  },

  async listRooms() {
    return apiRequest('/api/rooms', {
      method: 'GET',
    });
  },

  async closeRoom(roomId) {
    return apiRequest(`/api/rooms/${roomId}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Viewer API
 */
export const viewerAPI = {
  async joinRoom(code, nickname) {
    return apiRequest('/api/viewer/join', {
      method: 'POST',
      body: JSON.stringify({ code, nickname }),
    });
  },

  async getSession(viewerHash) {
    return apiRequest(`/api/viewer/session?viewer_hash=${viewerHash}`, {
      method: 'GET',
    });
  },
};

/**
 * Stories API
 */
export const storiesAPI = {
  async getStories(roomId, viewerHash = null) {
    if (!roomId) {
      throw new Error('roomId is required');
    }
    
    const url = viewerHash
      ? `/api/stories/room/${roomId}?viewer_hash=${viewerHash}`
      : `/api/stories/room/${roomId}`;
    
    return apiRequest(url, {
      method: 'GET',
    });
  },

  async getUploadUrl(roomId, mediaType, fileSize, contentType = null) {
    const body = {
      room_id: roomId,
      media_type: mediaType,
      file_size: fileSize,
      ...(contentType ? { content_type: contentType } : {}),
    };

    // Add viewer_hash if available (for viewers)
    const viewerHash = utils.getViewerHash();
    if (viewerHash) {
      body.viewer_hash = viewerHash;
    }

    return apiRequest('/api/stories/upload-url', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async createStory(roomId, mediaKey, mediaType) {
    const body = {
      room_id: roomId,
      media_key: mediaKey,
      media_type: mediaType,
    };

    // Add viewer_hash if available (for viewers)
    const viewerHash = utils.getViewerHash();
    if (viewerHash) {
      body.viewer_hash = viewerHash;
    }

    return apiRequest('/api/stories', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async recordView(storyId, viewerHash) {
    return apiRequest(`/api/stories/${storyId}/view`, {
      method: 'POST',
      body: JSON.stringify({ viewer_hash: viewerHash }),
    });
  },
};

/**
 * Utility functions
 */
export const utils = {
  /**
   * Guardar token de autenticación
   */
  setAuthToken(token) {
    localStorage.setItem('auth_token', token);
  },

  /**
   * Obtener token de autenticación
   */
  getAuthToken() {
    return localStorage.getItem('auth_token');
  },

  /**
   * Eliminar token de autenticación
   */
  clearAuthToken() {
    localStorage.removeItem('auth_token');
  },

  /**
   * Guardar viewer hash
   */
  setViewerHash(hash) {
    localStorage.setItem('viewer_hash', hash);
  },

  /**
   * Obtener viewer hash
   */
  getViewerHash() {
    return localStorage.getItem('viewer_hash');
  },

  /**
   * Guardar room ID
   */
  setRoomId(roomId) {
    localStorage.setItem('current_room_id', roomId);
  },

  /**
   * Obtener room ID
   */
  getRoomId() {
    return localStorage.getItem('current_room_id');
  },

  /**
   * Limpiar toda la sesión
   */
  clearSession() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('viewer_hash');
    localStorage.removeItem('current_room_id');
  },
};
