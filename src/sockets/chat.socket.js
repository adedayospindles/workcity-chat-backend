// sockets/chat.socket.js

import jwt from "jsonwebtoken";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { User } from "../models/User.js";

export const registerChatNamespace = (io) => {
	const nsp = io.of("/chat");

	nsp.use(async (socket, next) => {
		try {
			const token =
				socket.handshake.auth?.token || socket.handshake.query?.token;
			if (!token) return next(new Error("No token"));
			const decoded = jwt.verify(token, process.env.JWT_SECRET);
			const user = await User.findById(decoded.id).select("-password");
			if (!user) return next(new Error("Invalid token"));
			socket.user = user;
			next();
		} catch (e) {
			next(new Error("Unauthorized"));
		}
	});

	nsp.on("connection", (socket) => {
		const userId = socket.user._id.toString();

		// Simple presence
		socket.user.onlineAt = new Date();
		socket.user.save().catch(() => {});

		socket.emit("connected", { userId });

		socket.on("joinRoom", async ({ conversationId }) => {
			// ensure participant
			const convo = await Conversation.findById(conversationId);
			if (!convo)
				return socket.emit("error", { message: "Conversation not found" });
			const isParticipant = convo.participants.some(
				(p) => p.user.toString() === userId
			);
			if (!isParticipant)
				return socket.emit("error", { message: "Not a participant" });

			socket.join(conversationId);
			socket.emit("joined", { conversationId });
			// optional: mark messages read on join
			await Message.updateMany(
				{ conversation: conversationId, readBy: { $ne: socket.user._id } },
				{ $addToSet: { readBy: socket.user._id } }
			);
			nsp.to(conversationId).emit("read", { conversationId, userId });
		});

		socket.on("typing", ({ conversationId, isTyping }) => {
			socket
				.to(conversationId)
				.emit("typing", { conversationId, userId, isTyping: !!isTyping });
		});

		socket.on("sendMessage", async ({ conversationId, body, file }) => {
			const convo = await Conversation.findById(conversationId);
			if (!convo)
				return socket.emit("error", { message: "Conversation not found" });

			const isParticipant = convo.participants.some(
				(p) => p.user.toString() === userId
			);
			if (!isParticipant)
				return socket.emit("error", { message: "Not a participant" });

			const msg = await Message.create({
				conversation: conversationId,
				sender: socket.user._id,
				body: (body || "").toString(),
				file: file || undefined,
				readBy: [socket.user._id],
			});

			convo.lastMessageAt = new Date();
			await convo.save();

			nsp.to(conversationId).emit("message", msg);
		});

		socket.on("markRead", async ({ conversationId }) => {
			await Message.updateMany(
				{ conversation: conversationId, readBy: { $ne: socket.user._id } },
				{ $addToSet: { readBy: socket.user._id } }
			);
			nsp.to(conversationId).emit("read", { conversationId, userId });
		});

		socket.on("disconnect", () => {
			// presence offline timestamp
		});
	});

	return nsp;
};
