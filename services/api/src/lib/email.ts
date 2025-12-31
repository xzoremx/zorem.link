import { config } from '../config/env.js';
import type { EmailOptions } from '../types/index.js';

interface ResendErrorBody {
  message?: string;
  error?: string;
}

async function readErrorBody(response: Response): Promise<ResendErrorBody | null> {
  try {
    return (await response.json()) as ResendErrorBody;
  } catch {
    return null;
  }
}

interface EmailError extends Error {
  details?: ResendErrorBody | null;
}

export async function sendEmail({ to, subject, html, text }: EmailOptions): Promise<unknown> {
  if (!config.resendApiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  if (!config.resendFromEmail) {
    throw new Error('RESEND_FROM_EMAIL is not configured');
  }

  const payload = {
    from: config.resendFromEmail,
    to: Array.isArray(to) ? to : [to],
    subject,
    ...(html ? { html } : {}),
    ...(text ? { text } : {}),
  };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await readErrorBody(response);
    const message = body?.message ?? body?.error ?? response.statusText;
    const error = new Error(`Resend email failed: ${message}`) as EmailError;
    error.details = body;
    throw error;
  }

  return response.json();
}
