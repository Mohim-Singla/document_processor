import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const region = process.env.AWS_REGION || 'ap-south-1';
const bucketName = process.env.AWS_S3_BUCKET_NAME || 's3-document-processor';

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
  // Mock code only runs when ENV === 'test'
  if (process.env.ENV === 'test') {
    return {
      bucket: bucketName,
      key,
      location: `https://${bucketName}.s3.${region}.amazonaws.com/${key}`,
    };
  }

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
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
  return {
    bucket: bucketName,
    key,
    location: `https://${bucketName}.s3.${region}.amazonaws.com/${key}`,
  };
}

export async function getPresignedDownloadUrl({ key, expiresInSeconds = 900 }) {
  // Mock code only runs when ENV === 'test'
  if (process.env.ENV === 'test') {
    return `https://${bucketName}.s3.${region}.amazonaws.com/${key}?mockToken=true`;
  }

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error('AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) are missing in environment.');
  }

  const client = getClient();
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export async function deleteFromS3({ key }) {
  // Mock code only runs when ENV === 'test'
  if (process.env.ENV === 'test') {
    return true;
  }

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error('AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) are missing in environment.');
  }

  const client = getClient();
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  await client.send(command);
  return true;
}

export const s3Service = {
  uploadToS3,
  getPresignedDownloadUrl,
  deleteFromS3,
};
