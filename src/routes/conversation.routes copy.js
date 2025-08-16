// routes/conversation.routes.js
import express from "express";
import mongoose from "mongoose";
import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { StatusCodes } from "http-status-codes";

const router = express.Router();

/**
 * Create or find a conversation
 */
router.post("/", auth, async (req, res) => {
	try {
		const { participantIds = [], topic, productId } = req.body;

		const participants = Array.from(
			new Set([req.user._id.toString(), ...participantIds])
		).map((id) => ({
			user: new mongoose.Types.ObjectId(id),
			role: id === req.user._id.toString() ? req.user.role : "agent",
		}));

		if (participants.length < 2) {
			return res
				.status(StatusCodes.BAD_REQUEST)
				.json({ message: "At least 2 participants required" });
		}

		// Simplified existing conversation check
		const existing = await Conversation.findOne({
			"participants.user": { $all: participants.map((p) => p.user) },
			topic: topic || null,
		});

		if (existing) return res.json(existing);

		const convo = await Conversation.create({
			participants,
			topic: topic || null,
			productId: productId || null,
			lastMessageAt: new Date(),
		});

		res.status(StatusCodes.CREATED).json(convo);
	} catch (err) {
		console.error("❌ Error creating conversation:", err);
		res
			.status(StatusCodes.INTERNAL_SERVER_ERROR)
			.json({ message: "Server error", error: err.message });
	}
});

/**
 * List conversations for current user with unread counts & last message preview
 */
router.get("/", auth, async (req, res) => {
	try {
		const page = Math.max(1, parseInt(req.query.page || "1", 10));
		const limit = Math.min(50, parseInt(req.query.limit || "20", 10));
		const skip = (page - 1) * limit;

		const conversations = await Conversation.find({
			"participants.user": req.user._id,
		})
			.sort({ lastMessageAt: -1 })
			.skip(skip)
			.limit(limit)
			.populate({
				path: "lastMessage",
				populate: { path: "sender", select: "name email role" },
			})
			.lean();

		const convoIds = conversations.map((c) => c._id);
		const unreadCounts = await Message.aggregate([
			{
				$match: {
					conversation: { $in: convoIds },
					readBy: { $ne: req.user._id },
				},
			},
			{ $group: { _id: "$conversation", count: { $sum: 1 } } },
		]);

		const unreadMap = unreadCounts.reduce((map, item) => {
			map[item._id.toString()] = item.count;
			return map;
		}, {});

		const items = conversations.map((c) => ({
			...c,
			unreadCount: unreadMap[c._id.toString()] || 0,
		}));

		res.json({ items, page, limit, total: items.length });
	} catch (err) {
		console.error("❌ Error listing conversations:", err);
		res
			.status(StatusCodes.INTERNAL_SERVER_ERROR)
			.json({ message: "Server error" });
	}
});

/**
 * Get messages in a conversation
 */
router.get("/:id/messages", auth, async (req, res) => {
	try {
		const { id } = req.params;
		const page = Math.max(1, parseInt(req.query.page || "1", 10));
		const limit = Math.min(100, parseInt(req.query.limit || "30", 10));
		const skip = (page - 1) * limit;

		const convo = await Conversation.findById(id);
		if (!convo) {
			return res
				.status(StatusCodes.NOT_FOUND)
				.json({ message: "Conversation not found" });
		}

		if (
			!convo.participants.some(
				(p) => p.user.toString() === req.user._id.toString()
			)
		) {
			return res
				.status(StatusCodes.FORBIDDEN)
				.json({ message: "Not a participant" });
		}

		const messages = await Message.find({ conversation: id })
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit)
			.lean();

		res.json({
			items: messages.reverse(),
			page,
			limit,
			total: messages.length,
		});
	} catch (err) {
		console.error("❌ Error fetching messages:", err);
		res
			.status(StatusCodes.INTERNAL_SERVER_ERROR)
			.json({ message: "Server error" });
	}
});

/**
 * Delete a conversation
 */
router.delete("/:id", auth, requireRole("admin", "agent"), async (req, res) => {
	try {
		const { id } = req.params;

		const convo = await Conversation.findById(id);
		if (!convo) {
			return res
				.status(StatusCodes.NOT_FOUND)
				.json({ message: "Conversation not found" });
		}

		await Message.deleteMany({ conversation: id });
		await convo.deleteOne();

		res.json({ message: "Conversation deleted" });
	} catch (err) {
		console.error("❌ Error deleting conversation:", err);
		res
			.status(StatusCodes.INTERNAL_SERVER_ERROR)
			.json({ message: "Server error" });
	}
});

export default router;
