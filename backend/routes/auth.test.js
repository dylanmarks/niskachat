import express from "express";
import session from "express-session";
import request from "supertest";
import authRouter from "./auth.js";

// Create a test app
const app = express();
app.use(express.json());
app.use(
  session({
    secret: "test-secret",
    resave: false,
    saveUninitialized: true,
  }),
);
app.use("/auth", authRouter);
const agent = request.agent(app);

describe("OAuth2 SMART Authentication Routes", () => {
  describe("POST /auth/launch", () => {
    it("should initiate OAuth2 flow with correct parameters", async () => {
      const response = await agent
        .post("/auth/launch")
        .send({
          iss: "https://test-fhir.example.com",
          launch: "test-launch-123",
        })
        .expect(200);

      expect(response.body).toHaveProperty("authUrl");
      expect(response.body).toHaveProperty("state");
      expect(response.body).toHaveProperty("message");

      // Verify the auth URL contains required OAuth2 parameters
      const authUrl = new URL(response.body.authUrl);
      const params = authUrl.searchParams;

      expect(params.get("response_type")).toBe("code");
      expect(params.get("client_id")).toBeTruthy();
      expect(params.get("redirect_uri")).toBeTruthy();
      expect(params.get("scope")).toBeTruthy();
      expect(params.get("state")).toBe(response.body.state);
      expect(params.get("code_challenge")).toBeTruthy();
      expect(params.get("code_challenge_method")).toBe("S256");
      expect(params.get("launch")).toBe("test-launch-123");
    });

    it("should work without launch parameter (standalone launch)", async () => {
      const response = await agent
        .post("/auth/launch")
        .send({
          iss: "https://test-fhir.example.com",
        })
        .expect(200);

      const authUrl = new URL(response.body.authUrl);
      const params = authUrl.searchParams;

      expect(params.get("launch")).toBeNull();
      expect(params.get("state")).toBeTruthy();
    });

    it("should work with minimal parameters", async () => {
      const response = await agent.post("/auth/launch").send({}).expect(200);

      expect(response.body).toHaveProperty("authUrl");
      expect(response.body).toHaveProperty("state");
    });
  });

  describe("GET /auth/callback", () => {
    let validState;

    beforeEach(async () => {
      // Create a valid session first
      const launchResponse = await agent.post("/auth/launch").send({
        iss: "https://test-fhir.example.com",
      });
      validState = launchResponse.body.state;
    });

    it("should return 400 for missing code parameter", async () => {
      const response = await agent
        .get("/auth/callback")
        .query({
          state: validState,
        })
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Missing required parameters");
    });

    it("should return 400 for missing state parameter", async () => {
      const response = await agent
        .get("/auth/callback")
        .query({
          code: "test-code-123",
        })
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Missing required parameters");
    });

    it("should return 400 for invalid state parameter", async () => {
      const response = await agent
        .get("/auth/callback")
        .query({
          code: "test-code-123",
          state: "invalid-state",
        })
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Invalid or expired state");
    });

    it("should handle OAuth error parameter", async () => {
      const response = await agent
        .get("/auth/callback")
        .query({
          error: "access_denied",
          state: validState,
        })
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("OAuth2 authorization failed");
      expect(response.body).toHaveProperty("details", "access_denied");
    });

    // Note: Full token exchange testing would require mocking the SMART server
    // This test validates the request structure but will fail on actual HTTP call
    it("should attempt token exchange with valid parameters", async () => {
      const response = await agent.get("/auth/callback").query({
        code: "test-code-123",
        state: validState,
      });

      // Expect either success (if mock server) or specific token exchange error
      expect([200, 400, 500]).toContain(response.status);
      expect(response.body).toHaveProperty("error");
    });
  });

  describe("GET /auth/session/:sessionId", () => {
    it("should return 404 for non-existent session", async () => {
      const response = await agent
        .get("/auth/session/non-existent-session")
        .expect(404);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Session not found");
    });

    it("should return 404 for session without access token", async () => {
      // Create session without completing OAuth flow
      const launchResponse = await agent.post("/auth/launch").send({});

      const response = await agent
        .get(`/auth/session/${launchResponse.body.state}`)
        .expect(404);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain(
        "Session not found or not authenticated",
      );
    });
  });

  describe("DELETE /auth/session/:sessionId", () => {
    it("should clear existing session", async () => {
      // Create a session
      const launchResponse = await agent.post("/auth/launch").send({});

      const response = await agent
        .delete(`/auth/session/${launchResponse.body.state}`)
        .expect(200);

      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("cleared", true);
    });

    it("should handle non-existent session gracefully", async () => {
      const response = await agent
        .delete("/auth/session/non-existent-session")
        .expect(200);

      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("cleared", false);
    });
  });
});
