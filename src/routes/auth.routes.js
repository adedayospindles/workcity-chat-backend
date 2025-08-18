// src/routes/auth.routes.js
import express from "express";
import jwt from "jsonwebtoken";
import xss from "xss";
import { User, ROLES } from "../models/User.js";
import { StatusCodes } from "http-status-codes";

const router = express.Router();

const signAccessToken = (user) =>
	jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
		expiresIn: process.env.ACCESS_TOKEN_EXP || "15m",
	});

const signRefreshToken = (user) =>
	jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, {
		expiresIn: process.env.REFRESH_TOKEN_EXP || "7d",
	});

// Helper to send tokens
const sendTokens = (res, user) => {
	const accessToken = signAccessToken(user);
	const refreshToken = signRefreshToken(user);

	user.refreshToken = refreshToken;
	user.save();

	res.cookie("refreshToken", refreshToken, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "strict",
		maxAge: 7 * 24 * 60 * 60 * 1000,
	});

	return { accessToken, refreshToken };
};

// Signup
router.post("/signup", async (req, res) => {
	try {
		const { name, email, password, role = "customer" } = req.body;
		if (!name || !email || !password) {
			return res
				.status(StatusCodes.BAD_REQUEST)
				.json({ message: "Missing fields" });
		}
		if (!ROLES.includes(role)) {
			return res
				.status(StatusCodes.BAD_REQUEST)
				.json({ message: "Invalid role" });
		}

		const exists = await User.findOne({ email });
		if (exists) {
			return res
				.status(StatusCodes.CONFLICT)
				.json({ message: "Email already in use" });
		}

		const user = await User.create({
			name: xss(name),
			email: xss(email),
			password,
			role,
		});

		const { accessToken } = sendTokens(res, user);

		res.status(StatusCodes.CREATED).json({
			token: accessToken,
			user: {
				id: user._id,
				name: user.name,
				email: user.email,
				role: user.role,
			},
		});
	} catch (err) {
		console.error("Signup error:", err);
		res
			.status(StatusCodes.INTERNAL_SERVER_ERROR)
			.json({ message: "Server error", error: err.message });
	}
});

// Login
router.post("/login", async (req, res) => {
	try {
		const { email, password } = req.body;
		const user = await User.findOne({ email });
		if (!user || !(await user.comparePassword(password))) {
			return res
				.status(StatusCodes.UNAUTHORIZED)
				.json({ message: "Invalid credentials" });
		}

		const { accessToken } = sendTokens(res, user);

		res.json({
			token: accessToken,
			user: {
				id: user._id,
				name: user.name,
				email: user.email,
				role: user.role,
			},
		});
	} catch (err) {
		console.error("Login error:", err);
		res
			.status(StatusCodes.INTERNAL_SERVER_ERROR)
			.json({ message: "Server error", error: err.message });
	}
});

// Logout
router.post("/api/auth/logout", (req, res) => {
	// destroy session or clear token
	res.json({ success: true });
});

// Refresh endpoint
router.post("/refresh", async (req, res) => {
	try {
		const refreshToken = req.cookies?.refreshToken;
		if (!refreshToken) {
			return res
				.status(StatusCodes.UNAUTHORIZED)
				.json({ message: "No refresh token" });
		}

		const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
		const user = await User.findById(decoded.id);
		if (!user || user.refreshToken !== refreshToken) {
			return res
				.status(StatusCodes.UNAUTHORIZED)
				.json({ message: "Invalid refresh token" });
		}

		const accessToken = signAccessToken(user);
		res.json({ token: accessToken });
	} catch (err) {
		console.error("Refresh error:", err);
		res.status(StatusCodes.UNAUTHORIZED).json({
			message: "Refresh token invalid or expired",
			error: err.message,
		});
	}
});

export default router;
