// backend_alltest.js
import fetch from "node-fetch";
import { io } from "socket.io-client";

const API_BASE = "http://localhost:5000/api";

let user1 = {
	name: "User One",
	email: `user1+${Date.now()}@example.com`,
	password: "123456",
	role: "customer",
};
let user2 = {
	name: "User Two",
	email: `user2+${Date.now()}@example.com`,
	password: "123456",
	role: "agent",
};

let token1, token2, conversationId;

async function apiRequest(endpoint, method = "GET", body = null, token = null) {
	const res = await fetch(`${API_BASE}${endpoint}`, {
		method,
		headers: {
			"Content-Type": "application/json",
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: body ? JSON.stringify(body) : null,
	});
	const data = await res.json().catch(() => ({}));
	console.log(`\n🔹 ${method} ${endpoint}`, data);
	return data;
}

function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}

(async () => {
	try {
		// --- Signup/Login ---
		const signup1 = await apiRequest("/auth/signup", "POST", user1);
		const signup2 = await apiRequest("/auth/signup", "POST", user2);

		token1 = signup1.token;
		token2 = signup2.token;

		user1.id = signup1.user.id;
		user2.id = signup2.user.id;

		console.log("User1 ID:", user1.id);
		console.log("User2 ID:", user2.id);

		// --- Create conversation ---
		const convo = await apiRequest(
			"/conversations",
			"POST",
			{ participantIds: [user2.id], topic: "Support Chat" },
			token1
		);
		conversationId = convo._id;
		console.log("Conversation ID:", conversationId);

		// --- Connect sockets ---
		const socket1 = io("http://localhost:5000/chat", {
			auth: { token: token1 },
		});
		const socket2 = io("http://localhost:5000/chat", {
			auth: { token: token2 },
		});

		// Event listeners
		socket1.on("connected", (data) => console.log("Socket1 connected:", data));
		socket2.on("connected", (data) => console.log("Socket2 connected:", data));

		socket1.on("message", (msg) =>
			console.log("Socket1 received message:", msg)
		);
		socket2.on("message", (msg) =>
			console.log("Socket2 received message:", msg)
		);

		socket1.on("read", (data) => console.log("Socket1 read event:", data));
		socket2.on("read", (data) => console.log("Socket2 read event:", data));

		socket1.on("typing", (data) => console.log("Socket1 typing event:", data));
		socket2.on("typing", (data) => console.log("Socket2 typing event:", data));

		// Wait for connection
		await sleep(1000);

		// --- Join room ---
		socket1.emit("joinRoom", { conversationId });
		socket2.emit("joinRoom", { conversationId });

		await sleep(500);

		// --- Simulate chat flow ---
		const messagesUser1 = [
			"Hello, how are you?",
			"Did you get my previous message?",
			"Let's resolve this issue quickly.",
		];

		const messagesUser2 = [
			"Hi! I'm good, thanks!",
			"Yes, I saw it.",
			"Sure, let's go ahead.",
		];

		for (let i = 0; i < messagesUser1.length; i++) {
			// User1 typing
			socket1.emit("typing", { conversationId, isTyping: true });
			await sleep(Math.random() * 1000 + 500);
			socket1.emit("typing", { conversationId, isTyping: false });

			// User1 sends message
			socket1.emit("sendMessage", { conversationId, body: messagesUser1[i] });
			await sleep(500);

			// User2 typing
			socket2.emit("typing", { conversationId, isTyping: true });
			await sleep(Math.random() * 1000 + 500);
			socket2.emit("typing", { conversationId, isTyping: false });

			// User2 sends message
			socket2.emit("sendMessage", { conversationId, body: messagesUser2[i] });
			await sleep(500);
		}

		// --- Simulate file upload ---
		const filePayload = {
			conversationId,
			file: {
				name: "test_file.txt",
				url: "/uploads/test_file.txt",
				type: "text/plain",
				size: 12,
			},
		};
		socket1.emit("sendFileMessage", filePayload);

		await sleep(1000);

		// --- Mark as read ---
		socket1.emit("markRead", { conversationId });
		socket2.emit("markRead", { conversationId });

		await sleep(1000);

		socket1.disconnect();
		socket2.disconnect();

		console.log("\n✅ Enhanced chat simulation completed successfully");
	} catch (err) {
		console.error("❌ Test failed:", err);
	}
})();
