/**
 * Curated emoji list for Zorem avatars
 * Hand-picked for visual appeal and cross-platform support
 */

// Main curated list - these are the emojis shown in the selector
export const CURATED_EMOJIS = [
    // Faces - expressive
    '😀', '😂', '🥹', '😍', '🤩', '😎', '🥳', '😇',
    '🤗', '🤭', '🫣', '🤔', '🫡', '😴', '🤯', '🥸',
    // Faces - edgy/meme
    '😈', '💀', '👻', '🤡', '👽', '🤖', '😼', '🙀',
    // Faces - emotional
    '😭', '🥺', '😤', '🫠', '😶‍🌫️', '🙂‍↕️', '😵‍💫', '🫨',
    // Gestures
    '🫶', '🙌', '👀', '🗣️', '💅', '🫦', '🧠', '👁️',
    // Animals
    '🐶', '🐱', '🦊', '🐻', '🐼', '🐨', '🦁', '🐸',
    '🐙', '🦋', '🐝', '🦄', '🐲', '🦖', '🐳', '🦈',
    // Objects/symbols
    '🔥', '⭐', '💫', '✨', '💥', '❤️‍🔥', '🩷', '💜',
    '🎀', '🎭', '🎪', '🌈', '☀️', '🌙', '⚡', '🍀',
];

// Default avatar when none selected
export const DEFAULT_AVATAR = '😀';

// Pre-computed list for the selector (48 emojis)
export const BASE_EMOJI_LIST = CURATED_EMOJIS.slice(0, 48);

/**
 * Get random emojis from the curated list
 */
export function getRandomEmojis(count: number = 10): string[] {
    const shuffled = [...CURATED_EMOJIS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

/**
 * Build emoji list combining trending with curated
 */
export function buildEmojiList(trending: string[] = [], totalCount: number = 28): string[] {
    // Start with trending
    const result = [...trending];

    // Fill with curated emojis (excluding duplicates)
    const remaining = totalCount - result.length;
    const toAdd = CURATED_EMOJIS.filter(e => !result.includes(e)).slice(0, remaining);
    result.push(...toAdd);

    return result.slice(0, totalCount);
}
