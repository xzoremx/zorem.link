import type { Response } from 'express';
import type pg from 'pg';
import crypto from 'crypto';
import { pool } from '../db/pool.js';

const CHANNEL_NAME = 'room_events';
const INSTANCE_ID = crypto.randomUUID();

type RoomEventName = 'stories_changed';

export interface RoomEventPayload {
  room_id: string;
  stories_version?: number;
}

interface RoomEventMessage {
  event: RoomEventName;
  payload: RoomEventPayload;
  source_instance_id?: string;
}

const subscribersByRoomId = new Map<string, Set<Response>>();
let listenerClient: pg.PoolClient | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;

function writeSse(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function broadcastToRoom(roomId: string, message: RoomEventMessage): void {
  const subscribers = subscribersByRoomId.get(roomId);
  if (!subscribers || subscribers.size === 0) return;

  for (const res of subscribers) {
    try {
      writeSse(res, message.event, message.payload);
    } catch {
      // Best-effort cleanup if the connection is no longer writable.
      subscribers.delete(res);
    }
  }

  if (subscribers.size === 0) {
    subscribersByRoomId.delete(roomId);
  }
}

export function subscribeToRoom(roomId: string, res: Response): () => void {
  let subscribers = subscribersByRoomId.get(roomId);
  if (!subscribers) {
    subscribers = new Set<Response>();
    subscribersByRoomId.set(roomId, subscribers);
  }

  subscribers.add(res);

  return () => {
    const set = subscribersByRoomId.get(roomId);
    if (!set) return;
    set.delete(res);
    if (set.size === 0) {
      subscribersByRoomId.delete(roomId);
    }
  };
}

export async function publishRoomEvent(message: RoomEventMessage): Promise<void> {
  // Always broadcast locally so SSE works even if LISTEN/NOTIFY is down.
  broadcastToRoom(message.payload.room_id, message);

  const messageWithSource: RoomEventMessage = {
    ...message,
    source_instance_id: INSTANCE_ID,
  };

  try {
    await pool.query(`SELECT pg_notify('${CHANNEL_NAME}', $1)`, [
      JSON.stringify(messageWithSource),
    ]);
  } catch (error) {
    console.error('Failed to publish room event via NOTIFY:', error);
  }
}

export async function initRoomEventsListener(): Promise<void> {
  if (listenerClient) return;

  listenerClient = await pool.connect();
  await listenerClient.query(`LISTEN ${CHANNEL_NAME}`);

  listenerClient.on('notification', (msg) => {
    if (msg.channel !== CHANNEL_NAME) return;
    if (!msg.payload) return;

    try {
      const parsed = JSON.parse(msg.payload) as RoomEventMessage;
      if (parsed.source_instance_id === INSTANCE_ID) return;
      if (!parsed?.payload?.room_id) return;
      broadcastToRoom(parsed.payload.room_id, parsed);
    } catch {
      // Ignore invalid payloads
    }
  });

  const scheduleReconnect = () => {
    if (reconnectTimeout) return;
    reconnectTimeout = setTimeout(async () => {
      reconnectTimeout = null;
      try {
        await initRoomEventsListener();
      } catch (error) {
        console.error('Room events listener reconnect failed:', error);
        scheduleReconnect();
      }
    }, 5000);
  };

  listenerClient.on('error', (err: Error) => {
    console.error('Room events listener error:', err);
    try {
      listenerClient?.release(true);
    } catch {
      // Ignore release errors
    }
    listenerClient = null;
    scheduleReconnect();
  });

  console.log(`Room events listener started (LISTEN ${CHANNEL_NAME})`);
}
