// models/Message.js
import mongoose from "mongoose";
import { Conversation } from "./Conversation.js";

const fileSchema = new mongoose.Schema({
	url: String,
	name: String,
	type: String,
	size: Number,
});

const messageSchema = new mongoose.Schema(
	{
		conversation: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Conversation",
			required: true,
		},
		sender: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		body: { type: String, default: "" },
		file: fileSchema,
		readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
	},
	{ timestamps: true }
);

// Index for faster queries
messageSchema.index({ conversation: 1, createdAt: -1 });

// Middleware to auto-update conversation metadata
messageSchema.post("save", async function (doc, next) {
	try {
		await Conversation.findByIdAndUpdate(doc.conversation, {
			lastMessage: doc._id,
			lastMessageAt: new Date(),
		});
	} catch (err) {
		console.error("Error updating conversation lastMessage:", err);
	}
	next();
});

export const Message = mongoose.model("Message", messageSchema);
