import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

const SESSION_EXPIRES_IN_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

/**
 * Decodes a JWT's payload WITHOUT verifying its signature — never use this
 * for auth, only for diagnostic logging when the real (verified) call
 * below has already failed and we want to know *why* (mismatched aud/iss,
 * clock skew, wrong provider, ...) without re-trusting the token.
 */
function unsafeDecodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function logAuthFailure(step: string, err: unknown, idToken: string) {
  const claims = unsafeDecodeJwtPayload(idToken);
  console.error(`[api/auth/session] ${step} failed`, {
    // Firebase Admin errors are FirebaseAuthError instances with a stable
    // `.code` (e.g. "auth/argument-error", "auth/id-token-expired",
    // "auth/invalid-credential") — far more useful than the message alone.
    code: (err as { code?: string })?.code,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    // Unverified token claims, for spotting project/audience/clock-skew
    // mismatches at a glance — NOT proof the token is valid.
    tokenClaims: claims
      ? {
          iss: claims.iss,
          aud: claims.aud,
          iat: claims.iat,
          exp: claims.exp,
          nowUnix: Math.floor(Date.now() / 1000),
          signInProvider: (claims.firebase as { sign_in_provider?: string } | undefined)?.sign_in_provider,
          email: claims.email,
        }
      : "could not decode token payload",
    adminProjectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

export async function POST(request: NextRequest) {
  const { idToken } = await request.json();

  if (!idToken || typeof idToken !== "string") {
    return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
  }

  const adminAuth = getAdminAuth();

  // Split into two try/catches so the log always says which of the two
  // Admin SDK calls actually failed, instead of one shared catch that
  // can't tell verification failures from cookie-minting failures.
  try {
    // Reject stale tokens before minting a long-lived session cookie.
    await adminAuth.verifyIdToken(idToken);
  } catch (err) {
    logAuthFailure("verifyIdToken", err, idToken);
    return NextResponse.json({ error: "Invalid ID token" }, { status: 401 });
  }

  try {
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRES_IN_MS,
    });

    const response = NextResponse.json({ status: "ok" });
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      maxAge: SESSION_EXPIRES_IN_MS / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    return response;
  } catch (err) {
    logAuthFailure("createSessionCookie", err, idToken);
    return NextResponse.json({ error: "Invalid ID token" }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ status: "ok" });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
