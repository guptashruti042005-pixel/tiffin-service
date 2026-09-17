import mongoose from 'mongoose';
import dns from 'dns';

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
