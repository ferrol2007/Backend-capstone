const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(uri, { autoIndex: process.env.NODE_ENV !== 'production' });
  console.log(JSON.stringify({ level: 'info', event: 'database_connected', host: mongoose.connection.host }));
}

module.exports = connectDB;
