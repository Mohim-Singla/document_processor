import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AWS_CONFIG } from '../utils/constant/index.js';
import { logger } from '../utils/logger.js';

const CONTEXT = 's3Service';
const region = process.env.AWS_REGION || AWS_CONFIG.DEFAULT_REGION;
const bucketName = process.env.AWS_S3_BUCKET_NAME || AWS_CONFIG.DEFAULT_BUCKET_NAME;

let s3Client = null;

function getClient() {
  if (!s3Client) {
    s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }
  return s3Client;
}

export async function uploadToS3({ key, buffer, mimeType }) {
  const SUB_CONTEXT = uploadToS3.name;
  logger.info('Preparing to upload object to S3', CONTEXT, SUB_CONTEXT, { bucketName, key, mimeType, byteLength: buffer?.length });

  // Mock code only runs when ENV === 'test'
  if (process.env.ENV === 'test') {
    logger.debug('Running S3 upload in test mock mode', CONTEXT, SUB_CONTEXT, { key });
    return {
      bucket: bucketName,
      key,
      location: `https://${bucketName}.s3.${region}.amazonaws.com/${key}`,
    };
  }

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    logger.critical('AWS S3 credentials missing in environment', CONTEXT, SUB_CONTEXT);
    throw new Error('AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) are missing in environment.');
  }

  const client = getClient();
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  });

  await client.send(command);
  logger.info('Successfully uploaded object to S3', CONTEXT, SUB_CONTEXT, { bucketName, key });
  return {
    bucket: bucketName,
    key,
    location: `https://${bucketName}.s3.${region}.amazonaws.com/${key}`,
  };
}

export async function getPresignedDownloadUrl({
  key,
  expiresInSeconds = AWS_CONFIG.PRESIGNED_URL_EXPIRY_SECONDS,
  fileName = null,
  asAttachment = false,
}) {
  const SUB_CONTEXT = getPresignedDownloadUrl.name;
  logger.info('Generating presigned download URL', CONTEXT, SUB_CONTEXT, { bucketName, key, expiresInSeconds, fileName, asAttachment });

  // Mock code only runs when ENV === 'test'
  if (process.env.ENV === 'test') {
    logger.debug('Returning mock presigned URL in test mode', CONTEXT, SUB_CONTEXT, { key });
    return `https://${bucketName}.s3.${region}.amazonaws.com/${key}?mockToken=true`;
  }

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    logger.critical('AWS S3 credentials missing in environment', CONTEXT, SUB_CONTEXT);
    throw new Error('AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) are missing in environment.');
  }

  const client = getClient();
  const commandParams = {
    Bucket: bucketName,
    Key: key,
  };

  if (asAttachment) {
    const safeFileName = (fileName || 'download').replace(/["\r\n]/g, '_');
    commandParams.ResponseContentDisposition = `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(safeFileName)}`;
  }

  const command = new GetObjectCommand(commandParams);

  const url = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  logger.info('Presigned download URL successfully created', CONTEXT, SUB_CONTEXT, { key });
  return url;
}

export async function deleteFromS3({ key }) {
  const SUB_CONTEXT = deleteFromS3.name;
  logger.info('Deleting object from S3', CONTEXT, SUB_CONTEXT, { bucketName, key });

  // Mock code only runs when ENV === 'test'
  if (process.env.ENV === 'test') {
    logger.debug('Mock deleting S3 object in test mode', CONTEXT, SUB_CONTEXT, { key });
    return true;
  }

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    logger.critical('AWS S3 credentials missing in environment', CONTEXT, SUB_CONTEXT);
    throw new Error('AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) are missing in environment.');
  }

  const client = getClient();
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  await client.send(command);
  logger.info('Successfully deleted object from S3', CONTEXT, SUB_CONTEXT, { bucketName, key });
  return true;
}

export const s3Service = {
  uploadToS3,
  getPresignedDownloadUrl,
  deleteFromS3,
  getObjectBuffer,
};

/**
 * Downloads an object buffer from S3 given its S3 key
 */
export async function getObjectBuffer({ key, range }) {
  const SUB_CONTEXT = 'getObjectBuffer';
  logger.info('Downloading object buffer from S3', CONTEXT, SUB_CONTEXT, { bucketName, key, range });

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    logger.critical('AWS S3 credentials missing in environment', CONTEXT, SUB_CONTEXT);
    throw new Error('AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) are missing in environment.');
  }

  const client = getClient();
  const commandParams = {
    Bucket: bucketName,
    Key: key,
  };
  if (range) {
    commandParams.Range = range;
  }

  const command = new GetObjectCommand(commandParams);

  const response = await client.send(command);
  const byteArray = await response.Body.transformToByteArray();
  const buffer = Buffer.from(byteArray);
  logger.info('Successfully downloaded object buffer from S3', CONTEXT, SUB_CONTEXT, { key, byteLength: buffer.length });
  return buffer;
}
