import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import mime from 'mime-types';
import Redis from 'ioredis';
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const PROJECT_ID = process.env.PROJECT_ID ;
const REDIS_URL = process.env.REDIS_URL ;
const AWS_REGION = process.env.AWS_REGION ;
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID ;
const AWS_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY ;


const publisher = new Redis(REDIS_URL) ;

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY,
    secretAccessKey: AWS_SECRET_KEY,
  },
});

function publishLog(log) {
  publisher.publish(`logs:${PROJECT_ID}`, JSON.stringify({ log }));
}

async function init() {
  console.log('Executing script.js');
  publishLog('Build Started...');

  const outDirPath = path.join(__dirname, 'output');

  const buildCmd = `cd ${outDirPath} && npm install && npm run build`;
  const p = exec(buildCmd);

  p.stdout.on('data', (data) => {
    console.log(data.toString());
    publishLog(data.toString());
  });

  p.on('error', (err) => {
    console.error('Error:', err);
    publishLog(`error: ${err.message}`);
  });

  p.on('close', async (code) => {
    if (code !== 0) {
      publishLog(`Build failed with code ${code}`);
      return;
    }

    console.log('Build Complete');
    publishLog('Build Complete');

    const distFolderPath = path.join(outDirPath, 'dist');
    const distFolderContents = fs.readdirSync(distFolderPath, { recursive: true });
    
    publishLog('Starting upload to S3...');

    for (const file of distFolderContents) {
      const filePath = path.join(distFolderPath, file)
      if (fs.lstatSync(filePath).isDirectory()) continue;

      console.log('Uploading', filePath);
      publishLog(`Uploading ${file}`);

      const command = new PutObjectCommand({
        Bucket: 'demo-obj-bucket',
        Key: `__outputs/${PROJECT_ID}/${file}`,
        Body: fs.createReadStream(filePath),
        ContentType: mime.lookup(filePath) || 'application/octet-stream',
      });

      await s3Client.send(command);
      publishLog(`Uploaded ${filePath}`);
      console.log('Uploaded', file);
    }

    publishLog('All files uploaded successfully!');
    console.log('Done...');
  });
}

init().catch((err) => {
  console.error('Fatal Error:', err);
  publishLog(`Fatal Error: ${err.message}`);
});
