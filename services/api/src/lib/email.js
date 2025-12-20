import { config } from '../config/env.js';

async function readErrorBody(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function sendEmail({ to, subject, html, text }) {
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
    const message = body?.message || body?.error || response.statusText;
    const error = new Error(`Resend email failed: ${message}`);
    error.details = body;
    throw error;
  }

  return response.json();
}
