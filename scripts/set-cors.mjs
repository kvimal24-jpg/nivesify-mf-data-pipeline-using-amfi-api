// scripts/set-cors.mjs
// One-off script: enables CORS on the R2 bucket so browsers can
// fetch data files directly from https://data.nivesify.com
import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = "mf-data-bucket";

if (!accountId || !accessKeyId || !secretAccessKey) {
  console.error("Missing R2 credentials in environment.");
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

try {
  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ["*"],
            AllowedMethods: ["GET", "HEAD"],
            AllowedHeaders: ["*"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    })
  );
  console.log(`CORS enabled on bucket "${bucket}"`);
} catch (err) {
  console.error("Failed to set CORS:", err);
  process.exit(1);
}
