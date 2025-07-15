import express from "express";
import session from "express-session";
import request from "supertest";
import proxyRouter from "./proxy.js";

// Create test app
const createTestApp = () => {
  const app = express();

  // Session middleware
  app.use(
    session({
      secret: "test-secret",
      resave: false,
      saveUninitialized: false,
    }),
  );

  app.use(express.json());
  app.use("/proxy", proxyRouter);

  return app;
};

describe("FHIR Proxy Routes", () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  describe("Request Validation", () => {
    it("should require sessionId parameter", async () => {
      const response = await request(app).get("/proxy/fhir/Patient");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Missing required parameter: sessionId");
    });

    it("should reject dangerous path parameters", async () => {
      const response = await request(app).get(
        "/proxy/fhir/../etc/passwd?sessionId=test",
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid path parameter");
    });

    it("should reject paths with backslashes", async () => {
      const response = await request(app).get(
        "/proxy/fhir/..\\windows\\system32?sessionId=test",
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid path parameter");
    });

    it("should reject paths with tilde", async () => {
      const response = await request(app).get(
        "/proxy/fhir/~/secrets?sessionId=test",
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid path parameter");
    });
  });

  describe("Authentication", () => {
    it("should require valid authentication", async () => {
      // Without valid session, should get 401
      const response = await request(app).get(
        "/proxy/fhir/Patient?sessionId=test",
      );

      expect(response.status).toBe(401);
      expect(response.body.error).toBe(
        "Authentication required or token expired",
      );
    });
  });

  describe("CORS Headers", () => {
    it("should handle OPTIONS preflight requests", async () => {
      const response = await request(app)
        .options("/proxy/fhir/Patient")
        .set("Origin", "http://localhost:4200");

      expect(response.status).toBe(200);
      expect(response.headers["access-control-allow-origin"]).toBe(
        "http://localhost:4200",
      );
      expect(response.headers["access-control-allow-methods"]).toBe(
        "GET, POST, PUT, DELETE, OPTIONS",
      );
    });

    it("should handle OPTIONS preflight requests without origin", async () => {
      const response = await request(app).options("/proxy/fhir/Patient");

      expect(response.status).toBe(200);
      expect(response.headers["access-control-allow-origin"]).toBe("*");
      expect(response.headers["access-control-allow-methods"]).toBe(
        "GET, POST, PUT, DELETE, OPTIONS",
      );
    });
  });

  describe("Rate Limiting", () => {
    it("should apply rate limiting headers", async () => {
      const response = await request(app).get(
        "/proxy/fhir/Patient?sessionId=test",
      );

      // Even though the request might fail due to auth, rate limiting headers should be present
      expect(response.headers["ratelimit-limit"]).toBeDefined();
      expect(response.headers["ratelimit-remaining"]).toBeDefined();
      expect(response.headers["ratelimit-reset"]).toBeDefined();
    });
  });

  describe("HTTP Methods", () => {
    it("should handle GET requests", async () => {
      const response = await request(app).get(
        "/proxy/fhir/Patient?sessionId=test",
      );

      // Should fail with auth error, not method error
      expect(response.status).toBe(401);
      expect(response.body.error).toBe(
        "Authentication required or token expired",
      );
    });

    it("should handle POST requests", async () => {
      const requestBody = {
        resourceType: "Patient",
        name: [{ family: "Doe" }],
      };

      const response = await request(app)
        .post("/proxy/fhir/Patient?sessionId=test")
        .send(requestBody);

      // Should fail with auth error, not method error
      expect(response.status).toBe(401);
      expect(response.body.error).toBe(
        "Authentication required or token expired",
      );
    });

    it("should handle PUT requests", async () => {
      const requestBody = { resourceType: "Patient", id: "123" };

      const response = await request(app)
        .put("/proxy/fhir/Patient/123?sessionId=test")
        .send(requestBody);

      // Should fail with auth error, not method error
      expect(response.status).toBe(401);
      expect(response.body.error).toBe(
        "Authentication required or token expired",
      );
    });

    it("should handle DELETE requests", async () => {
      const response = await request(app).delete(
        "/proxy/fhir/Patient/123?sessionId=test",
      );

      // Should fail with auth error, not method error
      expect(response.status).toBe(401);
      expect(response.body.error).toBe(
        "Authentication required or token expired",
      );
    });

    it("should handle PATCH requests", async () => {
      const patchBody = [
        { op: "replace", path: "/name/0/family", value: "Smith" },
      ];

      const response = await request(app)
        .patch("/proxy/fhir/Patient/123?sessionId=test")
        .send(patchBody);

      // Should fail with auth error, not method error
      expect(response.status).toBe(401);
      expect(response.body.error).toBe(
        "Authentication required or token expired",
      );
    });
  });

  describe("Path Handling", () => {
    it("should handle simple resource paths", async () => {
      const response = await request(app).get(
        "/proxy/fhir/Patient?sessionId=test",
      );

      expect(response.status).toBe(401); // Auth error, not path error
    });

    it("should handle resource with ID paths", async () => {
      const response = await request(app).get(
        "/proxy/fhir/Patient/123?sessionId=test",
      );

      expect(response.status).toBe(401); // Auth error, not path error
    });

    it("should handle complex nested paths", async () => {
      const response = await request(app).get(
        "/proxy/fhir/Patient/123/Observation?sessionId=test",
      );

      expect(response.status).toBe(401); // Auth error, not path error
    });

    it("should handle paths with search parameters", async () => {
      const response = await request(app).get(
        "/proxy/fhir/Patient?sessionId=test&_count=10&family=Doe",
      );

      expect(response.status).toBe(401); // Auth error, not path error
    });
  });

  describe("Error Handling", () => {
    it("should handle requests without sessionId", async () => {
      const response = await request(app).get("/proxy/fhir/Patient");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Missing required parameter: sessionId");
    });

    it("should handle invalid resource paths", async () => {
      const response = await request(app).get("/proxy/fhir/?sessionId=test");

      expect(response.status).toBe(401); // Should get through validation but fail on auth
    });
  });
});
