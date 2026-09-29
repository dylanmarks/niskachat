import crypto from "crypto";
import express from "express";
import logger from "../utils/logger.js";

const router = express.Router();

// Session data is stored per-user via express-session

// SMART on FHIR configuration
function normalizeIssuer(issuer) {
  if (typeof issuer !== "string" || issuer.length > 2048) {
    return null;
  }

  try {
    const url = new URL(issuer);
    const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(
      url.hostname,
    );
    if (
      (url.protocol !== "https:" &&
        !(url.protocol === "http:" && isLoopback)) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

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

const allowedIssuers = new Set(
  (process.env.SMART_ALLOWED_ISSUERS || SMART_CONFIG.fhirBaseUrl)
    .split(",")
    .map((issuer) => normalizeIssuer(issuer.trim()))
    .filter(Boolean),
);

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
    const normalizedIssuer = normalizeIssuer(iss || SMART_CONFIG.fhirBaseUrl);
    if (!normalizedIssuer || !allowedIssuers.has(normalizedIssuer)) {
      return res.status(400).json({
        error: "FHIR issuer is not allowed",
        message:
          "Configure the exact HTTPS FHIR base URL in SMART_ALLOWED_ISSUERS.",
      });
    }

    // Generate state and PKCE parameters
    const state = crypto.randomBytes(16).toString("hex");
    const { codeVerifier, codeChallenge } = generatePKCE();

    // Store session data using express-session
    req.session.sessions = req.session.sessions || {};
    req.session.sessions[state] = {
      codeVerifier,
      iss: normalizedIssuer,
      launch,
      timestamp: Date.now(),
    };

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
    logger.error("SMART launch setup failed:", error?.name || "UnknownError");
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

    // Retrieve session data from express-session
    const session = req.session.sessions?.[state];
    if (!session) {
      return res.status(400).json({
        error: "Invalid or expired state parameter",
      });
    }

    // Clean up expired sessions (older than 10 minutes)
    if (Date.now() - session.timestamp > 10 * 60 * 1000) {
      delete req.session.sessions[state];
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
      logger.warn(
        "SMART token exchange was rejected by the authorization server",
      );
      return res.status(400).json({
        error: "Token exchange failed",
        details: "The authorization server rejected the exchange.",
      });
    }

    const tokenData = await tokenResponse.json();

    // Store token data securely in session
    req.session.sessions[state] = {
      ...session,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenType: tokenData.token_type || "Bearer",
      expiresIn: tokenData.expires_in,
      patient: tokenData.patient,
      scope: tokenData.scope,
      tokenTimestamp: Date.now(),
    };

    // Return success response
    res.json({
      message: "Authorization successful",
      sessionId: state,
      patient: tokenData.patient,
      scope: tokenData.scope,
      expiresIn: tokenData.expires_in,
    });
  } catch (error) {
    logger.error("SMART callback failed:", error?.name || "UnknownError");
    res.status(500).json({ error: "Authentication failed" });
  }
});

/**
 * GET /auth/session/:sessionId - Get session information
 */
router.get("/session/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const session = req.session.sessions?.[sessionId];

  if (!session || !session.accessToken) {
    return res
      .status(404)
      .json({ error: "Session not found or not authenticated" });
  }

  // Check if token is expired
  const tokenAge = Date.now() - session.tokenTimestamp;
  const isExpired = session.expiresIn && tokenAge > session.expiresIn * 1000;

  if (isExpired) {
    delete req.session.sessions[sessionId];
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
  const exists = req.session.sessions?.[sessionId];
  if (exists) {
    delete req.session.sessions[sessionId];
  }

  res.json({
    message: exists ? "Session cleared successfully" : "Session not found",
    cleared: Boolean(exists),
  });
});

/**
 * Internal helper to get access token for API calls
 */
export function getAccessToken(req, sessionId) {
  const session = req.session.sessions?.[sessionId];
  if (!session || !session.accessToken) {
    return null;
  }

  // Check if token is expired
  const tokenAge = Date.now() - session.tokenTimestamp;
  const isExpired = session.expiresIn && tokenAge > session.expiresIn * 1000;

  if (isExpired) {
    delete req.session.sessions[sessionId];
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
