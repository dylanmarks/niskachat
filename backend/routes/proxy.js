import express from "express";
import rateLimit from "express-rate-limit";
import { getAccessToken } from "./auth.js";

const router = express.Router();

// Rate limiting middleware
const proxyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: "Too many FHIR requests from this IP, please try again later.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiting to all proxy routes
router.use(proxyRateLimit);

/**
 * Request/response logging middleware
 */
function logRequest(req, res, next) {
  const start = Date.now();
  const originalSend = res.send;

  res.send = function (data) {
    const duration = Date.now() - start;
    console.log(`[FHIR Proxy] ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
    
    // Log errors for debugging
    if (res.statusCode >= 400) {
      console.error(`[FHIR Proxy Error] ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
      console.error(`Response: ${data}`);
    }
    
    return originalSend.call(this, data);
  };
  
  next();
}

router.use(logRequest);

/**
 * Validate FHIR request parameters
 */
function validateFhirRequest(req, res, next) {
  const { sessionId } = req.query;
  
  if (!sessionId) {
    return res.status(400).json({
      error: "Missing required parameter: sessionId",
    });
  }
  
  // Validate path doesn't contain dangerous characters
  const path = req.params.path;
  if (path && (path.includes("../") || path.includes("..\\") || path.includes("~"))) {
    return res.status(400).json({
      error: "Invalid path parameter",
    });
  }
  
  next();
}

/**
 * Authentication middleware
 */
function authenticate(req, res, next) {
  const { sessionId } = req.query;
  const tokenData = getAccessToken(req, sessionId);
  
  if (!tokenData) {
    return res.status(401).json({
      error: "Authentication required or token expired",
    });
  }
  
  req.tokenData = tokenData;
  next();
}

/**
 * Generic FHIR proxy handler
 */
async function proxyFhirRequest(req, res) {
  try {
    const { path } = req.params;
    const { sessionId, ...otherParams } = req.query;
    const { tokenData } = req;
    
    // Build target URL
    const fhirBaseUrl = tokenData.iss;
    let targetUrl = `${fhirBaseUrl}/${path}`;
    
    // Add query parameters (excluding sessionId)
    const queryParams = new URLSearchParams(otherParams);
    if (queryParams.toString()) {
      targetUrl += `?${queryParams.toString()}`;
    }
    
    // Prepare headers
    const headers = {
      "Authorization": `${tokenData.type} ${tokenData.token}`,
      "Accept": "application/fhir+json",
      "Content-Type": "application/fhir+json",
    };
    
    // Copy specific headers from original request
    const allowedHeaders = ["accept", "accept-language", "cache-control", "if-none-match"];
    allowedHeaders.forEach(header => {
      if (req.headers[header]) {
        headers[header] = req.headers[header];
      }
    });
    
    // Make the request
    const fetchOptions = {
      method: req.method,
      headers,
    };
    
    // Add body for POST/PUT/PATCH requests
    if (["POST", "PUT", "PATCH"].includes(req.method) && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }
    
    const response = await fetch(targetUrl, fetchOptions);
    
    // Handle authentication errors
    if (response.status === 401) {
      return res.status(401).json({
        error: "FHIR server authentication failed",
        details: "Token may be expired or invalid",
      });
    }
    
    // Set CORS headers
    res.set({
      "Access-Control-Allow-Origin": req.headers.origin || "*",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    });
    
    // Copy response headers
    const responseHeaders = ["content-type", "cache-control", "etag", "last-modified"];
    responseHeaders.forEach(header => {
      if (response.headers.get(header)) {
        res.set(header, response.headers.get(header));
      }
    });
    
    // Get response data
    const responseData = await response.text();
    
    // Return response with same status code
    res.status(response.status).send(responseData);
    
  } catch (error) {
    console.error("FHIR proxy error:", error);
    
    // Handle network errors
    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      return res.status(503).json({
        error: "FHIR server unavailable",
        details: "Unable to connect to FHIR server",
      });
    }
    
    // Handle timeout errors
    if (error.code === "ETIMEDOUT") {
      return res.status(504).json({
        error: "FHIR server timeout",
        details: "Request to FHIR server timed out",
      });
    }
    
    res.status(500).json({
      error: "Internal server error",
      details: "An unexpected error occurred while proxying the request",
    });
  }
}

/**
 * Handle OPTIONS requests for CORS preflight
 */
router.options("*", (req, res) => {
  res.set({
    "Access-Control-Allow-Origin": req.headers.origin || "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  });
  res.sendStatus(200);
});

/**
 * GET /proxy/fhir/:path - Proxy FHIR GET requests
 */
router.get("/fhir/:path(*)", validateFhirRequest, authenticate, proxyFhirRequest);

/**
 * POST /proxy/fhir/:path - Proxy FHIR POST requests
 */
router.post("/fhir/:path(*)", validateFhirRequest, authenticate, proxyFhirRequest);

/**
 * PUT /proxy/fhir/:path - Proxy FHIR PUT requests
 */
router.put("/fhir/:path(*)", validateFhirRequest, authenticate, proxyFhirRequest);

/**
 * DELETE /proxy/fhir/:path - Proxy FHIR DELETE requests
 */
router.delete("/fhir/:path(*)", validateFhirRequest, authenticate, proxyFhirRequest);

/**
 * PATCH /proxy/fhir/:path - Proxy FHIR PATCH requests
 */
router.patch("/fhir/:path(*)", validateFhirRequest, authenticate, proxyFhirRequest);

export default router;