/**
 * Emoji utilities using emoji-datasource
 */
import emojiData from 'emoji-datasource';

interface EmojiEntry {
    unified: string;
    short_name: string;
    category: string;
    sort_order: number;
}

/**
 * Convert Unicode code points to emoji string
 */
function unifiedToEmoji(unified: string): string {
    return unified
        .split('-')
        .map(u => String.fromCodePoint(parseInt(u, 16)))
        .join('');
}

/**
 * Categories we want to show for avatar selection
 */
const AVATAR_CATEGORIES = [
    'Smileys & Emotion',
    'People & Body',
    'Animals & Nature',
];

/**
 * Get base emoji list for avatar selection
 * Sorted by Unicode sort_order (most common first)
 */
export function getBaseEmojis(limit: number = 100): string[] {
    return (emojiData as EmojiEntry[])
        .filter(e => AVATAR_CATEGORIES.includes(e.category))
        // Exclude skin tone variants (they contain 1F3F)
        .filter(e => !e.unified.includes('1F3F'))
        // Exclude component emojis
        .filter(e => e.category !== 'Component')
        .sort((a, b) => a.sort_order - b.sort_order)
        .slice(0, limit)
        .map(e => unifiedToEmoji(e.unified));
}

/**
 * Get emojis by category
 */
export function getEmojisByCategory(category: string, limit: number = 50): string[] {
    return (emojiData as EmojiEntry[])
        .filter(e => e.category === category)
        .filter(e => !e.unified.includes('1F3F'))
        .sort((a, b) => a.sort_order - b.sort_order)
        .slice(0, limit)
        .map(e => unifiedToEmoji(e.unified));
}

/**
 * Get a random selection of emojis from the base list
 */
export function getRandomEmojis(count: number = 10): string[] {
    const base = getBaseEmojis(200);
    const shuffled = [...base].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

/**
 * Build the emoji list for the avatar selector
 * Combines trending (from API) with base emojis
 */
export function buildEmojiList(
    trending: string[] = [],
    totalCount: number = 24
): string[] {
    const base = getBaseEmojis(100);

    // Start with trending emojis (if any)
    const result: string[] = [...trending];

    // Fill remaining slots with base emojis (excluding already added)
    const remaining = totalCount - result.length;
    const toAdd = base.filter(e => !result.includes(e)).slice(0, remaining);
    result.push(...toAdd);

    // Add some randomness to the last few items
    const randomCount = Math.min(4, result.length);
    const randomEmojis = getRandomEmojis(randomCount * 2)
        .filter(e => !result.includes(e))
        .slice(0, randomCount);

    // Replace last items with random ones
    if (randomEmojis.length > 0) {
        result.splice(-randomCount, randomCount, ...randomEmojis);
    }

    return result.slice(0, totalCount);
}

/**
 * Default emoji for users who don't select one
 */
export const DEFAULT_AVATAR = '😀';

/**
 * Pre-computed base emojis for initial render (avoids computation on every render)
 */
export const BASE_EMOJI_LIST = getBaseEmojis(48);
