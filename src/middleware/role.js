import { StatusCodes } from "http-status-codes";

/**
 * Middleware to restrict route access to specific roles.
 * @param  {...string} allowed - List of allowed user roles.
 */
export const requireRole = (...allowed) => {
	return (req, res, next) => {
		if (!req.user) {
			return res
				.status(StatusCodes.UNAUTHORIZED)
				.json({ message: "Unauthorized: no user in request" });
		}

		if (!allowed.includes(req.user.role)) {
			return res.status(StatusCodes.FORBIDDEN).json({
				message: `Forbidden: role '${req.user.role}' does not have access`,
			});
		}

		next();
	};
};
