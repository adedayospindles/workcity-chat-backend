// models/User.Js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const roles = ["admin", "agent", "customer", "designer", "merchant"];

const UserSchema = new mongoose.Schema(
	{
		name: { type: String, required: true, trim: true },
		email: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
			index: true,
		},
		password: { type: String, required: true, minlength: 6 },
		role: { type: String, enum: roles, default: "customer", index: true },
		onlineAt: { type: Date },
	},
	{ timestamps: true }
);

UserSchema.pre("save", async function (next) {
	if (!this.isModified("password")) return next();
	const salt = await bcrypt.genSalt(10);
	this.password = await bcrypt.hash(this.password, salt);
	next();
});

UserSchema.methods.comparePassword = function (plain) {
	return bcrypt.compare(plain, this.password);
};

export const User = mongoose.model("User", UserSchema);
export const ROLES = roles;
