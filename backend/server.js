import cors from "cors";
import express from "express";
import helmet from "helmet";
import session from "express-session";
import authRouter from "./routes/auth.js";
import summarizeRouter from "./routes/summarize.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// Session middleware - uses in-memory store for development
app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-this-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    },
  }),
);

// CORS configuration
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",")
  : process.env.NODE_ENV === "production"
    ? ["https://yourdomain.com"] // Replace with your production frontend URL
    : ["http://localhost:4200"]; // Angular dev server

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

// Body parsing middleware
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "NiskaChat API is running",
    timestamp: new Date().toISOString(),
  });
});

// Auth routes
app.use("/auth", authRouter);

// Summarize routes
app.use("/summarize", summarizeRouter);

// Basic route
app.get("/", (req, res) => {
  res.json({ message: "NiskaChat FHIR API" });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Start server
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`🚀 NiskaChat API server running on port ${PORT}`);
  });
}

export default app;
