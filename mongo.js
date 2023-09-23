const { MongoClient } = require('mongodb');
const { dbUrl } = require('./config');

async function connectToCollectionUsers(email) {
  const client = new MongoClient(dbUrl);
  await client.connect();
  const db = client.db();
  const usersCollection = db.collection('users');
  const user = await usersCollection.findOne({ email });
  return user;
}

module.exports = { connectToCollectionUsers };
