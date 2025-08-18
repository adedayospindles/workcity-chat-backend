// routes/message.routes.js
import express from "express";
import multer from "multer";
import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";
import { Message } from "../models/Message.js";
import { Conversation } from "../models/Conversation.js";
import { StatusCodes } from "http-status-codes";

const router = express.Router();
const upload = multer({ dest: "uploads/" }); // TODO: replace with S3/GCS in prod

/**
 * Send a message (supports text only OR text + file/image/attachment)
 */
router.post(
	"/",
	auth,
	upload.fields([
		{ name: "file", maxCount: 1 },
		{ name: "image", maxCount: 1 },
		{ name: "attachment", maxCount: 1 },
	]),
	async (req, res) => {
		try {
			const { conversationId, body } = req.body;

			if (!conversationId) {
				return res
					.status(StatusCodes.BAD_REQUEST)
					.json({ message: "conversationId is required" });
			}

			const convo = await Conversation.findById(conversationId);
			if (!convo) {
				return res
					.status(StatusCodes.NOT_FOUND)
					.json({ message: "Conversation not found" });
			}

			// ✅ Check if sender is a participant
			if (
				!convo.participants.some(
					(p) => p.user.toString() === req.user._id.toString()
				)
			) {
				return res
					.status(StatusCodes.FORBIDDEN)
					.json({ message: "Not a participant in this conversation" });
			}

			// ✅ Normalize file input (accept file, image, or attachment — all optional)
			const uploadedFile =
				(req.files?.file && req.files.file[0]) ||
				(req.files?.image && req.files.image[0]) ||
				(req.files?.attachment && req.files.attachment[0]);

			// ✅ Create message with or without file
			const message = await Message.create({
				conversation: convo._id,
				sender: req.user._id,
				body: body || "", // allow empty body if file only
				file: uploadedFile
					? {
							url: `/uploads/${uploadedFile.filename}`,
							name: uploadedFile.originalname,
							type: uploadedFile.mimetype,
							size: uploadedFile.size,
					  }
					: undefined,
				readBy: [req.user._id],
			});

			// ✅ Update conversation metadata
			convo.lastMessageAt = new Date();
			convo.lastMessage = message._id;
			await convo.save();

			// ✅ Populate sender so frontend gets user info immediately
			await message.populate("sender", "name email role");

			res.status(StatusCodes.CREATED).json({
				message: "Message sent successfully",
				data: message,
			});
		} catch (e) {
			console.error("❌ Error sending message:", e);
			res
				.status(StatusCodes.INTERNAL_SERVER_ERROR)
				.json({ message: "Server error" });
		}
	}
);

/**
 * Mark all messages in a conversation as read by the current user
 */
router.post("/read", auth, async (req, res) => {
	try {
		const { conversationId } = req.body;

		if (!conversationId) {
			return res
				.status(StatusCodes.BAD_REQUEST)
				.json({ message: "conversationId is required" });
		}

		const convo = await Conversation.findById(conversationId);
		if (!convo) {
			return res
				.status(StatusCodes.NOT_FOUND)
				.json({ message: "Conversation not found" });
		}

		// Verify participant
		if (
			!convo.participants.some(
				(p) => p.user.toString() === req.user._id.toString()
			)
		) {
			return res
				.status(StatusCodes.FORBIDDEN)
				.json({ message: "Not a participant in this conversation" });
		}

		// Update unread messages
		const result = await Message.updateMany(
			{ conversation: conversationId, readBy: { $ne: req.user._id } },
			{ $addToSet: { readBy: req.user._id } }
		);

		res.json({
			message: "Messages marked as read",
			updatedCount: result.modifiedCount,
		});
	} catch (err) {
		console.error("❌ Error marking as read:", err);
		res
			.status(StatusCodes.INTERNAL_SERVER_ERROR)
			.json({ message: "Server error" });
	}
});

/**
 * Get all messages in a conversation
 */
router.get("/:conversationId", auth, async (req, res) => {
	try {
		const { conversationId } = req.params;

		const convo = await Conversation.findById(conversationId);
		if (!convo) {
			return res
				.status(StatusCodes.NOT_FOUND)
				.json({ message: "Conversation not found" });
		}

		// Verify participant
		if (
			!convo.participants.some(
				(p) => p.user.toString() === req.user._id.toString()
			)
		) {
			return res
				.status(StatusCodes.FORBIDDEN)
				.json({ message: "Not a participant in this conversation" });
		}

		// Fetch messages
		const messages = await Message.find({ conversation: conversationId })
			.sort({ createdAt: 1 })
			.populate("sender", "name email role");

		res.status(StatusCodes.OK).json(messages);
	} catch (err) {
		console.error("❌ Error fetching messages:", err);
		res
			.status(StatusCodes.INTERNAL_SERVER_ERROR)
			.json({ message: "Server error" });
	}
});

export default router;
