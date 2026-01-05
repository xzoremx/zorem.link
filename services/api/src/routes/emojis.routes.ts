import express, { type Request, type Response } from 'express';
import { query } from '../db/pool.js';
import { CURATED_EMOJIS } from '@zorem/shared';

const router = express.Router();

interface EmojiStatRow {
  emoji: string;
  use_count: number;
}

/**
 * GET /api/emojis/trending
 * Returns the most used emojis in Zorem
 */
router.get('/trending', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query<EmojiStatRow>(
      `SELECT emoji, use_count
       FROM emoji_stats
       ORDER BY use_count DESC, last_used_at DESC
       LIMIT 24`,
      []
    );

    let trending = result.rows.map((row) => row.emoji);

    // If we have less than 24 trending emojis, fill with curated
    if (trending.length < 24) {
      const missing = 24 - trending.length;
      const fillers = CURATED_EMOJIS.filter((emoji: string) => !trending.includes(emoji)).slice(0, missing);
      trending = [...trending, ...fillers];
    }

    res.json({
      trending,
      total: result.rows.length,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting trending emojis:', error);
    res.status(500).json({ error: 'Failed to get trending emojis' });
  }
});

export default router;
