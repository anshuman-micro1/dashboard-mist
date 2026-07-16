import { Db, MongoClient } from 'mongodb';

const mongoUri = process.env.MONGO_URI || '';
const databaseName = process.env.MONGO_DB || 'mist';

if (!mongoUri) {
  throw new Error('Missing MONGO_URI');
}

declare global {
  var __mongoClientPromise: Promise<MongoClient> | undefined;
}

const globalForMongo = globalThis as typeof globalThis & {
  __mongoClientPromise?: Promise<MongoClient>;
};

function getMongoClientPromise() {
  if (!globalForMongo.__mongoClientPromise) {
    const client = new MongoClient(mongoUri);
    globalForMongo.__mongoClientPromise = client.connect();
  }

  return globalForMongo.__mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClientPromise();
  return client.db(databaseName);
}
