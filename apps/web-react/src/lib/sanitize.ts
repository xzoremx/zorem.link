/**
 * Sanitization utilities using DOMPurify
 * Used to prevent XSS attacks from user-generated content
 */

import DOMPurify from 'dompurify';

/**
 * Sanitize HTML string - removes all potentially dangerous HTML
 * Use this for any user-generated content that might be rendered
 */
export function sanitizeHtml(dirty: string): string {
    return DOMPurify.sanitize(dirty, {
        ALLOWED_TAGS: [], // No HTML tags allowed by default
        ALLOWED_ATTR: [],
    });
}

/**
 * Sanitize HTML but allow basic formatting
 * Use this only when you explicitly need formatted text
 */
export function sanitizeRichText(dirty: string): string {
    return DOMPurify.sanitize(dirty, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'br'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
        ADD_ATTR: ['target'], // Force target="_blank" for links
    });
}

/**
 * Sanitize a URL to prevent javascript: and data: URLs
 */
export function sanitizeUrl(url: string): string {
    const trimmed = url.trim().toLowerCase();

    // Block dangerous protocols
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
 * Sanitize user input for display (escape HTML entities)
 */
export function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
