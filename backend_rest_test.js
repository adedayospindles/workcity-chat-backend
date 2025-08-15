import fetch from "node-fetch";

const API_BASE = "http://localhost:5000/api";

// Users
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

let token1 = "";
let token2 = "";
let conversationId = "";

// Helper for requests
async function apiRequest(endpoint, method = "GET", body = null, token = null) {
	try {
		const res = await fetch(`${API_BASE}${endpoint}`, {
			method,
			headers: {
				"Content-Type": "application/json",
				...(token ? { Authorization: `Bearer ${token}` } : {}),
			},
			body: body ? JSON.stringify(body) : null,
		});

		const status = res.status;
		const data = await res.json().catch(() => ({}));

		console.log(`\n🔹 ${method} ${endpoint}`);
		console.log(`   Status: ${status}`);
		console.log(`   Response:`, data);

		return data;
	} catch (err) {
		console.error(`❌ Request to ${endpoint} failed:`, err);
		return {};
	}
}

(async () => {
	try {
		// 1. Health check
		await apiRequest("/../health");

		// 2. Signup users
		await apiRequest("/auth/signup", "POST", user1);
		await apiRequest("/auth/signup", "POST", user2);

		// 3. Login User 1
		const login1 = await apiRequest("/auth/login", "POST", {
			email: user1.email,
			password: user1.password,
		});
		token1 = login1.token;
		user1.id = login1.user?.id || login1.user?._id;
		console.log("User1 ID:", user1.id);

		// 4. Login User 2
		const login2 = await apiRequest("/auth/login", "POST", {
			email: user2.email,
			password: user2.password,
		});
		token2 = login2.token;
		user2.id = login2.user?.id || login2.user?._id;
		console.log("User2 ID:", user2.id);

		// 5. Create conversation (User 1 initiates)
		const convo = await apiRequest(
			"/conversations",
			"POST",
			{
				participantIds: [user2.id],
				topic: "Support Chat",
			},
			token1
		);
		conversationId = convo._id || convo.id;
		console.log("Conversation ID:", conversationId);

		// 6. User 1 sends a message
		await apiRequest(
			"/messages",
			"POST",
			{
				conversationId,
				body: "Hello! I need help with my order.",
			},
			token1
		);

		// 7. User 2 replies
		await apiRequest(
			"/messages",
			"POST",
			{
				conversationId,
				body: "Hi! How can I assist you today?",
			},
			token2
		);

		// 8. Fetch messages in the conversation
		await apiRequest(`/messages/${conversationId}`, "GET", null, token1);

		console.log("\n✅ Backend API Test Completed Successfully");
	} catch (err) {
		console.error("❌ Test script failed:", err);
	}
})();
