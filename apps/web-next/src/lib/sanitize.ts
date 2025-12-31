/**
 * Sanitization utilities
 * Used to prevent XSS attacks from user-generated content
 */

/**
 * Sanitize HTML string - removes all potentially dangerous HTML
 */
export function sanitizeHtml(dirty: string): string {
    // Simple sanitization for SSR compatibility
    return dirty
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

/**
 * Sanitize a URL to prevent javascript: and data: URLs
 */
export function sanitizeUrl(url: string): string {
    const trimmed = url.trim().toLowerCase();

    if (
        trimmed.startsWith('javascript:') ||
        trimmed.startsWith('data:') ||
        trimmed.startsWith('vbscript:')
    ) {
        return '';
    }

    return url;
}

/**
 * Escape HTML entities for safe display
 */
export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}
