import mongoose from 'mongoose';
import dns from 'dns';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to ensure server/.env is loaded
const ensureEnvLoaded = () => {
  if (!process.env.MONGO_URI) {
    // 1. server/.env (resolved from server/src/config/../../.env)
    dotenv.config({ path: path.resolve(__dirname, '../../.env') });
  }
  if (!process.env.MONGO_URI) {
    // 2. root .env (resolved from server/src/config/../../../.env)
    dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
  }
  if (!process.env.MONGO_URI) {
    // 3. CWD fallback
    dotenv.config();
  }
};

// Immediately ensure environment is loaded upon import
ensureEnvLoaded();

// Ensure reliable DNS SRV resolution across environments
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Continue with default DNS if custom servers cannot be set
}

export const connectDB = async (customUri = null) => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // Ensure server/.env is loaded before reading process.env.MONGO_URI
  ensureEnvLoaded();

  let uri = customUri || process.env.MONGO_URI;

  if (!uri) {
    console.error('MongoDB connection error: MONGO_URI is not defined in environment variables');
    process.exit(1);
  }

  // Use isolated test database on Atlas during automated testing
  if (process.env.NODE_ENV === 'test') {
    if (uri.includes('?')) {
      uri = uri.replace(/\/[^/?]+(\?)/, '/tiffintrack_test$1');
    } else {
      uri = uri.replace(/\/[^/?]+$/, '/tiffintrack_test');
    }
  }

  try {
    const conn = await mongoose.connect(uri);
    return conn;
  } catch (error) {
    if (mongoose.connection.readyState === 1 || error.message?.includes('openUri()')) {
      return mongoose.connection;
    }
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
