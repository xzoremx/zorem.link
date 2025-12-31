import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { config } from '../config/env.js';
import type { MediaType, ContentTypeInfo } from '../types/index.js';

let s3Client: S3Client | null = null;

interface S3ClientConfig {
  region: string;
  requestChecksumCalculation: 'WHEN_REQUIRED';
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  endpoint?: string;
}

/**
 * Initialize S3/R2 client
 */
function getS3Client(): S3Client {
  if (!s3Client) {
    if (!config.awsAccessKeyId || !config.awsSecretAccessKey) {
      throw new Error('AWS credentials not configured');
    }

    const clientConfig: S3ClientConfig = {
      region: config.awsRegion,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      credentials: {
        accessKeyId: config.awsAccessKeyId,
        secretAccessKey: config.awsSecretAccessKey,
      },
    };

    if (config.storageType === 'r2' && config.r2Endpoint) {
      clientConfig.endpoint = config.r2Endpoint;
    }

    s3Client = new S3Client(clientConfig);
  }

  return s3Client;
}

/**
 * Generate a presigned URL for uploading a file
 */
export async function generateUploadUrl(
  mediaKey: string,
  contentType: string,
  expiresIn: number = 300
): Promise<string> {
  const client = getS3Client();

  const command = new PutObjectCommand({
    Bucket: config.s3BucketName,
    Key: mediaKey,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Generate a presigned URL for downloading/viewing a file
 */
export async function generateDownloadUrl(
  mediaKey: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getS3Client();

  const command = new GetObjectCommand({
    Bucket: config.s3BucketName,
    Key: mediaKey,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Delete a file from S3/R2
 */
export async function deleteFile(mediaKey: string): Promise<void> {
  const client = getS3Client();

  const command = new DeleteObjectCommand({
    Bucket: config.s3BucketName,
    Key: mediaKey,
  });

  await client.send(command);
}

/**
 * Generate a unique media key for a story
 */
export function generateMediaKey(
  roomId: string,
  mediaType: MediaType,
  fileExtension: string
): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  return `stories/${roomId}/${timestamp}-${random}.${fileExtension}`;
}

/**
 * Resolve content type and file extension from media type
 */
export function resolveUploadContent(
  mediaType: MediaType,
  requestedContentType?: string
): ContentTypeInfo {
  const normalized =
    typeof requestedContentType === 'string'
      ? requestedContentType.toLowerCase().trim()
      : '';

  const imageTypes: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };

  const videoTypes: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  };

  if (!normalized) {
    return mediaType === 'image'
      ? { contentType: 'image/jpeg', fileExtension: 'jpg' }
      : { contentType: 'video/mp4', fileExtension: 'mp4' };
  }

  if (mediaType === 'image') {
    const ext = imageTypes[normalized];
    if (!ext) {
      throw new Error('Unsupported image content_type');
    }
    return { contentType: normalized, fileExtension: ext };
  }

  if (mediaType === 'video') {
    const ext = videoTypes[normalized];
    if (!ext) {
      throw new Error('Unsupported video content_type');
    }
    return { contentType: normalized, fileExtension: ext };
  }

  throw new Error('Invalid media_type');
}
