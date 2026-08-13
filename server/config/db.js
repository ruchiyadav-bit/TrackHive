const mongoose = require('mongoose');

const connectDB = async (retries = 5) => {
  for (let i = 1; i <= retries; i++) {
    try {
      const uri = process.env.MONGODB_URI;
      const conn = await mongoose.connect(uri, {
        dbName: 'trackhive',
        serverSelectionTimeoutMS: 10000,
        retryWrites: true,
      });
      console.log(`MongoDB connected: ${conn.connection.host}`);
      return;
    } catch (error) {
      console.error(`MongoDB connection attempt ${i}/${retries} failed: ${error.message}`);
      if (i === retries) {
        console.error('All MongoDB connection attempts failed. Exiting.');
        process.exit(1);
      }
      // Wait before retrying (exponential backoff)
      const wait = Math.min(i * 2000, 10000);
      console.log(`Retrying in ${wait / 1000}s...`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
};

module.exports = connectDB;
