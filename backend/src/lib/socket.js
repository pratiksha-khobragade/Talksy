import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);

// In production, frontend and backend use the same origin.
// FRONTEND_URL can still be provided through environment variables.
const allowedOrigin =
  process.env.FRONTEND_URL || true;

const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    credentials: true,
  },
});

// Online users:
// {
//   mongoUserId: socketId
// }
const userSocketMap = {};

function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;

  if (userId) {
    userSocketMap[userId] = socket.id;
  }

  // Tell everyone who is currently online.
  io.emit(
    "getOnlineUsers",
    Object.keys(userSocketMap),
  );

  socket.on("disconnect", () => {
    if (userId) {
      delete userSocketMap[userId];
    }

    io.emit(
      "getOnlineUsers",
      Object.keys(userSocketMap),
    );
  });
});

export {
  app,
  server,
  io,
  getReceiverSocketId,
};