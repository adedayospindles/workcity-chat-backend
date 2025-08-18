// src/middleware/auth.js
import jwt from "jsonwebtoken";
import { StatusCodes } from "http-status-codes";
import { User } from "../models/User.js";

export const auth = async (req, res, next) => {
	try {
		const authHeader = req.headers.authorization;
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			console.warn(
				"❌ No Authorization header or malformed header:",
				req.headers
			);
			return res
				.status(StatusCodes.UNAUTHORIZED)
				.json({ message: "No token provided" });
		}

		const token = authHeader.split(" ")[1];

		try {
			// Verify Access Token
			const decoded = jwt.verify(token, process.env.JWT_SECRET);
			req.user = await User.findById(decoded.id).select("-password");
			if (!req.user) {
				console.warn("❌ Token valid but user not found:", decoded.id);
				return res
					.status(StatusCodes.UNAUTHORIZED)
					.json({ message: "User not found" });
			}
			console.log("✅ Authenticated user:", req.user.email || req.user._id);
			return next();
		} catch (err) {
			console.error("❌ Token verification failed:", err.message);

			if (err.name === "TokenExpiredError") {
				console.warn("⚠️ Access token expired, trying refresh...");

				const refreshToken = req.cookies?.refreshToken;
				if (!refreshToken) {
					console.warn("❌ No refresh token provided in cookies");
					return res
						.status(StatusCodes.UNAUTHORIZED)
						.json({ message: "Token expired, please login again" });
				}

				try {
					const decodedRefresh = jwt.verify(
						refreshToken,
						process.env.JWT_REFRESH_SECRET
					);
					const user = await User.findById(decodedRefresh.id);

					if (!user || user.refreshToken !== refreshToken) {
						console.warn(
							"❌ Invalid refresh token for user:",
							decodedRefresh.id
						);
						return res
							.status(StatusCodes.UNAUTHORIZED)
							.json({ message: "Invalid refresh token" });
					}

					// Rotate refresh token
					const newRefreshToken = jwt.sign(
						{ id: user._id },
						process.env.JWT_REFRESH_SECRET,
						{
							expiresIn: process.env.REFRESH_TOKEN_EXP || "7d",
						}
					);
					user.refreshToken = newRefreshToken;
					await user.save();

					res.cookie("refreshToken", newRefreshToken, {
						httpOnly: true,
						secure: process.env.NODE_ENV === "production",
						sameSite: "strict",
						maxAge: 7 * 24 * 60 * 60 * 1000,
					});

					// New access token
					const newAccessToken = jwt.sign(
						{ id: user._id, role: user.role },
						process.env.JWT_SECRET,
						{ expiresIn: process.env.ACCESS_TOKEN_EXP || "15m" }
					);

					res.setHeader("x-access-token", newAccessToken);

					req.user = user;
					console.log(
						"✅ Issued new access token for:",
						user.email || user._id
					);
					return next();
				} catch (refreshErr) {
					console.error(
						"❌ Refresh token verification failed:",
						refreshErr.message
					);
					return res
						.status(StatusCodes.UNAUTHORIZED)
						.json({ message: "Refresh token expired, please login" });
				}
			}

			return res
				.status(StatusCodes.UNAUTHORIZED)
				.json({ message: "Invalid token" });
		}
	} catch (err) {
		console.error("🔥 Auth middleware server error:", err);
		return res
			.status(StatusCodes.INTERNAL_SERVER_ERROR)
			.json({ message: "Server error" });
	}
};
