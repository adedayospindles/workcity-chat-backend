// models/Conversation.js
import mongoose from "mongoose";

const participantSchema = new mongoose.Schema({
	user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
	role: {
		type: String,
		enum: ["customer", "agent", "admin", "designer", "merchant"], // updated to match User roles
		required: true,
	},
});

const conversationSchema = new mongoose.Schema(
	{
		participants: [participantSchema],
		topic: { type: String, default: null },
		productId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Product",
			default: null,
		},
		lastMessageAt: { type: Date, default: Date.now },
		lastMessage: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Message",
			default: null,
		},
	},
	{ timestamps: true }
);

// Indexes for faster lookups & sorting
conversationSchema.index({ "participants.user": 1 });
conversationSchema.index({ lastMessageAt: -1 });

export const Conversation = mongoose.model("Conversation", conversationSchema);
