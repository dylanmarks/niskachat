import request from "supertest";
import app from "../server.js";

const taskInput = {
  title: "Review elevated HbA1c",
  description: "Confirm the result and arrange appropriate follow-up.",
  priority: "urgent",
  patientReference: "Patient/example",
  initialComment: "Created during care coordination review.",
};

describe("Task API", () => {
  it("creates a FHIR R4 Task with standard version metadata", async () => {
    const agent = request.agent(app);
    const response = await agent.post("/api/tasks").send(taskInput).expect(201);

    expect(response.headers.etag).toBe('W/"1"');
    expect(response.body.task).toMatchObject({
      resourceType: "Task",
      intent: "order",
      status: "requested",
      meta: { versionId: "1" },
      for: { reference: "Patient/example" },
    });
    expect(response.body.task).not.toHaveProperty("version");
    expect(response.body.task).not.toHaveProperty("_sessionId");
    expect(response.body.task.note[0]).toHaveProperty(
      "authorString",
      "Demo user",
    );
    expect(response.body.task.note[0]).not.toHaveProperty("authorReference");
  });

  it("isolates demo tasks between browser sessions", async () => {
    const firstSession = request.agent(app);
    const secondSession = request.agent(app);
    const created = await firstSession
      .post("/api/tasks")
      .send(taskInput)
      .expect(201);

    await firstSession.get(`/api/tasks/${created.body.task.id}`).expect(200);
    await secondSession.get(`/api/tasks/${created.body.task.id}`).expect(404);

    const list = await secondSession.get("/api/tasks").expect(200);
    expect(list.body).toMatchObject({ count: 0, tasks: [] });
  });

  it("uses weak ETags for optimistic concurrency", async () => {
    const agent = request.agent(app);
    const created = await agent.post("/api/tasks").send(taskInput).expect(201);
    const taskId = created.body.task.id;

    const updated = await agent
      .post(`/api/tasks/${taskId}/comments`)
      .set("If-Match", 'W/"1"')
      .send({ text: "Patient contacted." })
      .expect(200);

    expect(updated.headers.etag).toBe('W/"2"');
    expect(updated.body.task.meta.versionId).toBe("2");
    expect(updated.body.task.note).toHaveLength(2);

    await agent
      .post(`/api/tasks/${taskId}/comments`)
      .set("If-Match", 'W/"1"')
      .send({ text: "Stale update." })
      .expect(412);
  });

  it("rejects invalid task priority values", async () => {
    await request(app)
      .post("/api/tasks")
      .send({ ...taskInput, priority: "whenever" })
      .expect(400);
  });
});
