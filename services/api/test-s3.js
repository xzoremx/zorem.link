#!/usr/bin/env node

/**
 * Script para probar la configuración de S3
 * Uso: node scripts/test-s3.js
 */

import dotenv from 'dotenv';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand } from '@aws-sdk/client-s3';

dotenv.config();

async function testS3() {
  console.log('\n🧪 Testing S3 Configuration...\n');
  console.log('='.repeat(50));

  // 1. Verificar variables de entorno
  console.log('\n📋 Step 1: Checking environment variables...');
  
  const requiredVars = {
    'AWS_ACCESS_KEY_ID': process.env.AWS_ACCESS_KEY_ID,
    'AWS_SECRET_ACCESS_KEY': process.env.AWS_SECRET_ACCESS_KEY ? '***configured***' : undefined,
    'AWS_REGION': process.env.AWS_REGION || 'us-east-1',
    'S3_BUCKET_NAME': process.env.S3_BUCKET_NAME,
    'STORAGE_TYPE': process.env.STORAGE_TYPE || 's3'
  };

  let allConfigured = true;
  for (const [key, value] of Object.entries(requiredVars)) {
    if (value) {
      console.log(`   ✅ ${key}: ${value}`);
    } else {
      console.log(`   ❌ ${key}: NOT SET`);
      allConfigured = false;
    }
  }

  if (!allConfigured) {
    console.log('\n❌ Missing required environment variables!');
    console.log('   Please check your .env file.\n');
    process.exit(1);
  }

  // 2. Crear cliente S3
  console.log('\n📡 Step 2: Creating S3 client...');
  try {
    const clientConfig = {
      region: requiredVars.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    };

    const s3Client = new S3Client(clientConfig);
    console.log('   ✅ S3 client created');

    // 3. Verificar que el bucket existe
    console.log(`\n🪣 Step 3: Checking if bucket "${requiredVars.S3_BUCKET_NAME}" exists...`);
    try {
      const headCommand = new HeadBucketCommand({
        Bucket: requiredVars.S3_BUCKET_NAME
      });
      await s3Client.send(headCommand);
      console.log('   ✅ Bucket exists and is accessible');

      // 4. Generar URL presignada de prueba
      console.log('\n🔗 Step 4: Testing presigned URL generation...');
      const testKey = `test/connection-test-${Date.now()}.txt`;
      const command = new PutObjectCommand({
        Bucket: requiredVars.S3_BUCKET_NAME,
        Key: testKey,
        ContentType: 'text/plain',
      });

      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
      console.log('   ✅ Presigned URL generated successfully');
      console.log(`   📝 Test key: ${testKey}`);
      console.log(`   🔗 URL: ${presignedUrl.substring(0, 80)}...`);

      console.log('\n' + '='.repeat(50));
      console.log('✅ All S3 tests passed! Your configuration is correct.\n');
      console.log('💡 Note: The test key will not be created unless you upload to the URL.');
      console.log('   This is just a test of URL generation.\n');

    } catch (bucketError) {
      console.log('   ❌ Error accessing bucket:', bucketError.message);
      if (bucketError.name === 'NotFound' || bucketError.Code === '404') {
        console.log('\n   💡 The bucket does not exist. Please create it in AWS S3 Console.');
      } else if (bucketError.name === 'Forbidden' || bucketError.Code === '403') {
        console.log('\n   💡 Permission denied. Check your IAM user has S3 access.');
      }
      process.exit(1);
    }

  } catch (clientError) {
    console.log('   ❌ Error creating S3 client:', clientError.message);
    console.log('   💡 Check your AWS credentials are correct.\n');
    process.exit(1);
  }
}

testS3().catch((error) => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
