// backend_test3.js
import axios from "axios";
import { io } from "socket.io-client";
import FormData from "form-data";
import fs from "fs";

// Base API URL
const BASE_URL = "http://localhost:5000/api";

// --------------------
// Helper: Sign up users
// --------------------
const signupUser = async (name, email, role) => {
	const res = await axios.post(`${BASE_URL}/auth/signup`, {
		name,
		email,
		password: "password123",
		role,
	});
	console.log(`🔹 POST /auth/signup`, res.data);
	return res.data;
};

// --------------------
// Helper: Login user
// --------------------
const loginUser = async (email) => {
	const res = await axios.post(`${BASE_URL}/auth/login`, {
		email,
		password: "password123",
	});
	console.log(`🔹 POST /auth/login`, res.data);
	return res.data;
};

// --------------------
// Helper: Create conversation
// --------------------
const createConversation = async (
	token,
	participantIds,
	topic = "Support Chat"
) => {
	const res = await axios.post(
		`${BASE_URL}/conversations`,
		{ participantIds, topic },
		{ headers: { Authorization: `Bearer ${token}` } }
	);
	console.log(`🔹 POST /conversations`, res.data);
	return res.data;
};

// --------------------
// Helper: Delay
// --------------------
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --------------------
// Main test
// --------------------
const runTest = async () => {
	try {
		// --------------------
		// 1️⃣ Health check
		// --------------------
		const health = await axios.get("http://localhost:5000/health");
		console.log("🔹 GET /health", health.data);

		// --------------------
		// 2️⃣ Sign up users
		// --------------------
		const user1Data = await signupUser(
			"User One",
			`user1+${Date.now()}@example.com`,
			"customer"
		);
		const user2Data = await signupUser(
			"User Two",
			`user2+${Date.now()}@example.com`,
			"agent"
		);

		const user1 = await loginUser(user1Data.user.email);
		const user2 = await loginUser(user2Data.user.email);

		console.log("User1 ID:", user1.user.id);
		console.log("User2 ID:", user2.user.id);

		// --------------------
		// 3️⃣ Create conversation
		// --------------------
		const conversation = await createConversation(user1.token, [
			user2.user.id, // note backend expects participantIds array
		]);
		const conversationId = conversation._id;
		console.log("Conversation ID:", conversationId);

		// --------------------
		// 4️⃣ Connect users via Socket.IO
		// --------------------
		const socket1 = io("http://localhost:5000/chat", {
			auth: { token: user1.token },
		});
		const socket2 = io("http://localhost:5000/chat", {
			auth: { token: user2.token },
		});

		// Track connections
		socket1.on("connected", (data) => console.log("Socket1 connected:", data));
		socket2.on("connected", (data) => console.log("Socket2 connected:", data));

		// --------------------
		// 5️⃣ Join conversation room
		// --------------------
		socket1.emit("joinRoom", { conversationId });
		socket2.emit("joinRoom", { conversationId });

		socket1.on("joined", (data) => console.log("Socket1 joined room:", data));
		socket2.on("joined", (data) => console.log("Socket2 joined room:", data));

		// --------------------
		// 6️⃣ Listen for messages and read events
		// --------------------
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

		// --------------------
		// 7️⃣ Typing simulation
		// --------------------
		socket1.emit("typing", { conversationId, isTyping: true });
		await delay(1000);
		socket1.emit("typing", { conversationId, isTyping: false });

		// --------------------
		// 8️⃣ Send messages
		// --------------------
		socket1.emit("sendMessage", { conversationId, body: "Hello from User1!" });
		socket2.emit("sendMessage", {
			conversationId,
			body: "Hi User1, this is User2!",
		});

		// --------------------
		// 9️⃣ Send a file message
		// --------------------
		const form = new FormData();
		form.append("conversationId", conversationId); // ✅ include conversationId
		form.append("file", fs.createReadStream("./test_file.txt")); // ensure this file exists

		const fileMessage = await axios.post(`${BASE_URL}/messages`, form, {
			headers: {
				Authorization: `Bearer ${user1.token}`,
				...form.getHeaders(),
			},
		});
		console.log("File message sent:", fileMessage.data);

		// --------------------
		// 10️⃣ Mark messages as read
		// --------------------
		socket1.emit("markRead", { conversationId });
		socket2.emit("markRead", { conversationId });

		// Wait a bit for all events
		await delay(2000);

		// --------------------
		// 11️⃣ Disconnect sockets
		// --------------------
		socket1.disconnect();
		socket2.disconnect();

		console.log("✅ Socket.IO chat test completed successfully");
	} catch (err) {
		console.error("❌ Test error", err.response?.data || err.message);
	}
};

runTest();
