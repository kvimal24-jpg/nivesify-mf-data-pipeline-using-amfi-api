// scripts/set-cors.mjs
const accountId = process.env.R2_ACCOUNT_ID;
const token = process.env.CF_API_TOKEN;

if (!accountId || !token) {
  console.error("Missing R2_ACCOUNT_ID or CF_API_TOKEN");
  process.exit(1);
}

const res = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/mf-data-bucket/cors`,
  {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      rules: [
        {
          allowed: { origins: ["*"], methods: ["GET", "HEAD"] },
          maxAgeSeconds: 3600,
        },
      ],
    }),
  }
);

const body = await res.text();
console.log(res.status, body);
if (!res.ok) {
  console.error("Failed");
  process.exit(1);
}
console.log("CORS enabled");
