import crypto from "crypto";
import express from "express";

const router = express.Router();

// In-memory storage for demo purposes (use Redis/database in production)
const sessions = new Map();

// SMART on FHIR configuration
const SMART_CONFIG = {
  // Default to SMART Health IT sandbox
  clientId: process.env.SMART_CLIENT_ID || "your-client-id",
  redirectUri:
    process.env.SMART_REDIRECT_URI || "http://localhost:3000/auth/callback",
  scope: process.env.SMART_SCOPE || "openid profile patient/*.read",
  // SMART Health IT Sandbox endpoints
  authUrl:
    process.env.SMART_AUTH_URL ||
    "https://launch.smarthealthit.org/v/r4/auth/authorize",
  tokenUrl:
    process.env.SMART_TOKEN_URL ||
    "https://launch.smarthealthit.org/v/r4/auth/token",
  fhirBaseUrl:
    process.env.SMART_FHIR_BASE_URL ||
    "https://launch.smarthealthit.org/v/r4/fhir",
};

/**
 * Generate PKCE code verifier and challenge
 */
function generatePKCE() {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}

/**
 * POST /auth/launch - Initiate SMART on FHIR OAuth2 flow
 */
router.post("/launch", (req, res) => {
  try {
    const { iss, launch } = req.body;

    // Generate state and PKCE parameters
    const state = crypto.randomBytes(16).toString("hex");
    const { codeVerifier, codeChallenge } = generatePKCE();

    // Store session data
    sessions.set(state, {
      codeVerifier,
      iss: iss || SMART_CONFIG.fhirBaseUrl,
      launch,
      timestamp: Date.now(),
    });

    // Build authorization URL
    const authParams = new URLSearchParams({
      response_type: "code",
      client_id: SMART_CONFIG.clientId,
      redirect_uri: SMART_CONFIG.redirectUri,
      scope: SMART_CONFIG.scope,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    // Add launch parameter if provided (for EHR launch)
    if (launch) {
      authParams.append("launch", launch);
    }

    const authUrl = `${SMART_CONFIG.authUrl}?${authParams.toString()}`;

    res.json({
      authUrl,
      state,
      message: "Redirect user to authUrl to begin OAuth2 flow",
    });
  } catch (error) {
    console.error("Auth launch error:", error);
    res.status(500).json({ error: "Failed to initiate OAuth2 flow" });
  }
});

/**
 * GET /auth/callback - Handle OAuth2 callback
 */
router.get("/callback", async (req, res) => {
  try {
    const { code, state, error } = req.query;

    // Handle OAuth errors
    if (error) {
      return res.status(400).json({
        error: "OAuth2 authorization failed",
        details: error,
      });
    }

    // Validate required parameters
    if (!code || !state) {
      return res.status(400).json({
        error: "Missing required parameters: code and state",
      });
    }

    // Retrieve session data
    const session = sessions.get(state);
    if (!session) {
      return res.status(400).json({
        error: "Invalid or expired state parameter",
      });
    }

    // Clean up expired sessions (older than 10 minutes)
    if (Date.now() - session.timestamp > 10 * 60 * 1000) {
      sessions.delete(state);
      return res.status(400).json({
        error: "Session expired. Please restart the authorization flow.",
      });
    }

    // Exchange authorization code for access token
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: SMART_CONFIG.redirectUri,
      client_id: SMART_CONFIG.clientId,
      code_verifier: session.codeVerifier,
    });

    const tokenResponse = await fetch(SMART_CONFIG.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token exchange failed:", errorData);
      return res.status(400).json({
        error: "Token exchange failed",
        details: errorData,
      });
    }

    const tokenData = await tokenResponse.json();

    // Store token data securely (extend session)
    sessions.set(state, {
      ...session,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenType: tokenData.token_type || "Bearer",
      expiresIn: tokenData.expires_in,
      patient: tokenData.patient,
      scope: tokenData.scope,
      tokenTimestamp: Date.now(),
    });

    // Return success response
    res.json({
      message: "Authorization successful",
      sessionId: state,
      patient: tokenData.patient,
      scope: tokenData.scope,
      expiresIn: tokenData.expires_in,
    });
  } catch (error) {
    console.error("Auth callback error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
});

/**
 * GET /auth/session/:sessionId - Get session information
 */
router.get("/session/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session || !session.accessToken) {
    return res
      .status(404)
      .json({ error: "Session not found or not authenticated" });
  }

  // Check if token is expired
  const tokenAge = Date.now() - session.tokenTimestamp;
  const isExpired = session.expiresIn && tokenAge > session.expiresIn * 1000;

  if (isExpired) {
    sessions.delete(sessionId);
    return res.status(401).json({ error: "Token expired" });
  }

  res.json({
    authenticated: true,
    patient: session.patient,
    scope: session.scope,
    iss: session.iss,
    expiresAt: session.tokenTimestamp + session.expiresIn * 1000,
  });
});

/**
 * DELETE /auth/session/:sessionId - Logout/clear session
 */
router.delete("/session/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const deleted = sessions.delete(sessionId);

  res.json({
    message: deleted ? "Session cleared successfully" : "Session not found",
    cleared: deleted,
  });
});

/**
 * Internal helper to get access token for API calls
 */
export function getAccessToken(sessionId) {
  const session = sessions.get(sessionId);
  if (!session || !session.accessToken) {
    return null;
  }

  // Check if token is expired
  const tokenAge = Date.now() - session.tokenTimestamp;
  const isExpired = session.expiresIn && tokenAge > session.expiresIn * 1000;

  if (isExpired) {
    sessions.delete(sessionId);
    return null;
  }

  return {
    token: session.accessToken,
    type: session.tokenType,
    iss: session.iss,
    patient: session.patient,
  };
}

export default router;
