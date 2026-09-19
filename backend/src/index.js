import express from "express";
import cors from "cors";

import "dotenv/config";

import fs from "fs";
import path from "path";

import { clerkMiddleware } from "@clerk/express";

import { connectDB } from "./lib/db.js";
import job from "./lib/cron.js";

import clerkWebhook from "./webhooks/clerk.webhook.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import contactRoutes from "./routes/contact.route.js";

import { app, server } from "./lib/socket.js";

const PORT = process.env.PORT || 3000;

// In production, frontend and backend are served from the same origin.
// FRONTEND_URL can still be provided through environment variables if needed.
const FRONTEND_URL = process.env.FRONTEND_URL || true;

const publicDir = path.join(process.cwd(), "public");

/*
  IMPORTANT:
  Clerk webhooks must receive the raw request body.
  So this route must be registered before express.json().
*/
app.use(
  "/api/webhooks/clerk",
  express.raw({ type: "application/json" }),
  clerkWebhook,
);

app.use(express.json());

/*
  CORS
  - Local development can use FRONTEND_URL from .env.
  - Production uses the same origin because frontend and backend
    are served by the same Render service.
*/
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  }),
);

app.use(clerkMiddleware());

/*
  Health check
*/
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true });
});

/*
  Authentication
*/
app.use("/api/auth", authRoutes);

/*
  Messages
*/
app.use("/api/messages", messageRoutes);

/*
  Contacts / Add User / Requests
*/
app.use("/api/contacts", contactRoutes);

/*
  Serve React frontend in production.
*/
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));

  app.get("/{*any}", (req, res, next) => {
    res.sendFile(path.join(publicDir, "index.html"), (err) => next(err));
  });
}

/*
  Start server
*/
server.listen(PORT, () => {
  connectDB();

  console.log("Server is up and running on PORT:", PORT);

  if (process.env.NODE_ENV === "production") {
    job.start();
  }
});