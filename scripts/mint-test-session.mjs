// Phase 10 regression-testing helper: mints a real, legitimate session
// cookie for the Owner account using the Firebase Admin SDK (the same SDK
// /api/auth/session already uses), so live browser E2E tests can run
// authenticated without needing the account's actual password. Prints the
// cookie value to stdout only — writes nothing to disk, sends nothing
// anywhere but this machine's own dev/prod server.
//
// Usage: node scripts/mint-test-session.mjs > /tmp/session-cookie.txt
import { config } from "dotenv";
config({ path: new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") });
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});
const auth = getAuth(app);

const ownerEmail = process.env.OWNER_EMAIL?.trim();
if (!ownerEmail) throw new Error("OWNER_EMAIL not set in .env.local");

const userRecord = await auth.getUserByEmail(ownerEmail);
const customToken = await auth.createCustomToken(userRecord.uid);

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const exchangeRes = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  }
);
const exchangeJson = await exchangeRes.json();
if (!exchangeJson.idToken) {
  throw new Error("Failed to exchange custom token: " + JSON.stringify(exchangeJson));
}

const baseUrl = process.argv[2] || "http://localhost:3000";
const sessionRes = await fetch(`${baseUrl}/api/auth/session`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ idToken: exchangeJson.idToken }),
});
const setCookie = sessionRes.headers.get("set-cookie");
if (!setCookie) {
  throw new Error("No Set-Cookie header returned: " + (await sessionRes.text()));
}
const sessionValue = setCookie.split(";")[0].split("=").slice(1).join("=");
console.log(sessionValue);
