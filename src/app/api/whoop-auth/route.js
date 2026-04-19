// ═══════════════════════════════════════════
// WHOOP OAuth — Step 1: Redirect to WHOOP login
// GET /api/whoop-auth → redirects user to WHOOP authorization page
// ═══════════════════════════════════════════

import { NextResponse } from "next/server";

export async function GET(request) {
  const clientId = process.env.WHOOP_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json({
      error: "WHOOP_CLIENT_ID not configured",
      setup: "1. Go to developer.whoop.com → Create an app → Get Client ID & Secret. 2. Set WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET as Vercel env vars.",
    }, { status: 500 });
  }

  const { origin } = new URL(request.url);
  const redirectUri = `${origin}/api/whoop-callback`;

  // Scopes: read workouts + offline (for refresh token)
  const scopes = [
    "read:workout",
    "read:recovery",
    "read:cycles",
    "read:profile",
    "read:body_measurement",
    "offline",
  ].join(" ");

  const authUrl = new URL("https://api.prod.whoop.com/oauth/oauth2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("state", "berlin-marathon-sync");

  return NextResponse.redirect(authUrl.toString());
}
