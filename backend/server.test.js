import request from "supertest";
import app from "./server.js";

describe("NiskaChat API", () => {
  describe("GET /health", () => {
    it("should return 200 status", async () => {
      const response = await request(app).get("/health").expect(200);

      expect(response.body).toHaveProperty("status", "OK");
      expect(response.body).toHaveProperty(
        "message",
        "NiskaChat API is running",
      );
      expect(response.body).toHaveProperty("timestamp");
    });
  });

  describe("GET /", () => {
    it("should return API message", async () => {
      const response = await request(app).get("/").expect(200);

      expect(response.body).toHaveProperty("message", "NiskaChat FHIR API");
    });
  });

  describe("GET /nonexistent", () => {
    it("should return 404 for unknown routes", async () => {
      const response = await request(app).get("/nonexistent").expect(404);

      expect(response.body).toHaveProperty("error", "Route not found");
    });
  });
});
