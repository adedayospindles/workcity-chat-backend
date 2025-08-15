/*import mongoose from "mongoose";

export const connectDB = async (uri) => {
	mongoose.set("strictQuery", true);
	await mongoose.connect(uri, {
		autoIndex: true,
	});
	console.log("✅ MongoDB connected");
};*/
// Your current IP address (102.89.33.131) has been added to enable local connectivity.

// src/config/db.js
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// Store details of the current DB connection for debugging/display in routes
export let currentDbInfo = { source: null, name: null };

export const connectDB = async () => {
	// Enable strict query filtering in Mongoose
	mongoose.set("strictQuery", true);

	// Read connection settings from environment variables
	const useAtlas = process.env.USE_ATLAS === "true"; // Toggle in .env
	const atlasUri = process.env.MONGO_URI_CLOUD; // MongoDB Atlas URI
	const localUri = process.env.MONGO_URI_LOCAL; // Local MongoDB URI

	/**
	 * Extracts DB name from a MongoDB URI (works for both local and Atlas)
	 * Examples:
	 * - mongodb+srv://user:pass@cluster.mongodb.net/workcity-chat?retryWrites=true
	 *     -> workcity-chat
	 * - mongodb://127.0.0.1:27017/workcity-chat
	 *     -> workcity-chat
	 */
	const getDbName = (uri) => {
		try {
			const cleanUri = uri.split("?")[0]; // remove query params
			return (
				cleanUri.substring(cleanUri.lastIndexOf("/") + 1) ||
				"(no database specified)"
			);
		} catch {
			return "(unknown)";
		}
	};

	// --- Try Atlas first if enabled ---
	if (useAtlas) {
		try {
			const dbName = getDbName(atlasUri);
			console.log(`🌍 Connecting to MongoDB Atlas (Database: ${dbName})...`);
			await mongoose.connect(atlasUri, {
				useNewUrlParser: true,
				useUnifiedTopology: true,
				autoIndex: true,
			});
			currentDbInfo = { source: "Atlas", name: dbName };
			console.log("✅ Connected to MongoDB Atlas");
			return;
		} catch (err) {
			console.warn("⚠️ Atlas connection failed:", err.message);
			console.log("💻 Falling back to Local MongoDB...");
		}
	}

	// --- Try local connection ---
	try {
		const dbName = getDbName(localUri);
		console.log(`💻 Connecting to Local MongoDB (Database: ${dbName})...`);
		await mongoose.connect(localUri, {
			useNewUrlParser: true,
			useUnifiedTopology: true,
			autoIndex: true,
		});
		currentDbInfo = { source: "Local", name: dbName };
		console.log("✅ Connected to Local MongoDB");
	} catch (localErr) {
		console.error(
			"❌ Failed to connect to any MongoDB instance:",
			localErr.message
		);
		process.exit(1); // Exit the process if both connections fail
	}
};
