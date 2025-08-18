// src/index.js
import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { Server as SocketIOServer } from "socket.io";

// Import DB connection + info
import { connectDB, currentDbInfo } from "./config/db.js";

// Import routes
import authRoutes from "./routes/auth.routes.js";
import conversationRoutes from "./routes/conversation.routes.js";
import messageRoutes from "./routes/message.routes.js";

// Import Socket namespace
import { registerChatNamespace } from "./sockets/chat.socket.js";

const app = express();
const server = http.createServer(app);

// --------------------
// Middleware setup
// --------------------

// Enable CORS (Cross-Origin Resource Sharing)
app.use(
	cors({
		origin: (origin, callback) => {
			const allowed = process.env.CORS_ORIGIN
				? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
				: [];

			// ✅ Allow Postman/curl (no origin), wildcard, or exact match
			if (!origin || allowed.includes("*") || allowed.includes(origin)) {
				return callback(null, true);
			}

			// ❌ Otherwise block
			return callback(new Error(`CORS blocked for origin: ${origin}`));
		},
		credentials: true, // 🔑 allow cookies (refresh token, session)
	})
);

// Parse incoming JSON (limit to 5MB payloads)
app.use(express.json({ limit: "5mb" }));

// Parse cookies from requests
app.use(cookieParser());

// Log HTTP requests in console (dev format)
app.use(morgan("dev"));

// Serve static files from /uploads folder
app.use("/uploads", express.static("uploads"));

// --------------------
// API Routes
// --------------------
app.use("/api/auth", authRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);

// --------------------
// Root route
// --------------------
app.get("/", (req, res) => {
	res.send(`
		<h1>🚀 WorkCity Chat API</h1>
		<p>Server is running in <strong>${process.env.NODE_ENV}</strong> mode.</p>
		<p>Database Source: <strong>${
			currentDbInfo.source || "Not connected"
		}</strong></p>
		<p>Database Name: <strong>${currentDbInfo.name || "N/A"}</strong></p>
		<p>Check <a href="/health">/health</a> for status.</p>
	`);
});

// --------------------
// Health check route
// --------------------
app.get("/health", (_req, res) => res.json({ ok: true }));

// --------------------
// Socket.IO setup
// --------------------
const io = new SocketIOServer(server, {
	cors: {
		origin: (origin, callback) => {
			const allowed = process.env.CORS_ORIGIN
				? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
				: [];

			if (!origin || allowed.includes("*") || allowed.includes(origin)) {
				return callback(null, true);
			}

			return callback(
				new Error(`❌ Socket.IO CORS blocked for origin: ${origin}`)
			);
		},
		credentials: true, // 🔑 allow cookies for socket auth too
	},
});
registerChatNamespace(io);

// --------------------
// Start server
// --------------------
const PORT = process.env.PORT || 5000;

connectDB()
	.then(() => {
		server.listen(PORT, () => {
			console.log(`🚀 Server listening on http://localhost:${PORT}`);
		});
	})
	.catch((err) => {
		console.error("❌ Mongo connection error", err);
		process.exit(1);
	});
