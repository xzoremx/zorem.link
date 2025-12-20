import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { config } from '../config/env.js';

let s3Client;

/**
 * Initialize S3/R2 client
 */
function getS3Client() {
  if (!s3Client) {
    const clientConfig = {
      region: config.awsRegion,
      // Avoid injecting checksum params into presigned PUT URLs (breaks browser uploads)
      requestChecksumCalculation: 'WHEN_REQUIRED',
      credentials: {
        accessKeyId: config.awsAccessKeyId,
        secretAccessKey: config.awsSecretAccessKey,
      },
    };

    // If using Cloudflare R2, set custom endpoint
    if (config.storageType === 'r2' && config.r2Endpoint) {
      clientConfig.endpoint = config.r2Endpoint;
    }

    s3Client = new S3Client(clientConfig);
  }

  return s3Client;
}

/**
 * Generate a presigned URL for uploading a file
 * @param {string} mediaKey - The S3 key for the file
 * @param {string} contentType - MIME type (e.g., 'image/jpeg', 'video/mp4')
 * @param {number} expiresIn - URL expiration time in seconds (default: 300 = 5 minutes)
 * @returns {Promise<string>} Presigned URL
 */
export async function generateUploadUrl(mediaKey, contentType, expiresIn = 300) {
  const client = getS3Client();
  
  const command = new PutObjectCommand({
    Bucket: config.s3BucketName,
    Key: mediaKey,
    ContentType: contentType,
  });

  const url = await getSignedUrl(client, command, { expiresIn });
  return url;
}

/**
 * Delete a file from S3/R2
 * @param {string} mediaKey - The S3 key for the file
 * @returns {Promise<void>}
 */
export async function deleteFile(mediaKey) {
  const client = getS3Client();
  
  const command = new DeleteObjectCommand({
    Bucket: config.s3BucketName,
    Key: mediaKey,
  });

  await client.send(command);
}

/**
 * Generate a unique media key for a story
 * @param {string} roomId - The room ID
 * @param {string} mediaType - 'image' or 'video'
 * @param {string} fileExtension - File extension (e.g., 'jpg', 'mp4')
 * @returns {string} Media key
 */
export function generateMediaKey(roomId, mediaType, fileExtension) {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  return `stories/${roomId}/${timestamp}-${random}.${fileExtension}`;
}
