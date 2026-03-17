const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'cbr_reader';

const DEFAULT_COLORS = [
  { hex: '#d4a054', label: 'Oro' },
  { hex: '#e05555', label: 'Rosso' },
  { hex: '#5b9bd5', label: 'Blu' },
  { hex: '#6bc76b', label: 'Verde' },
  { hex: '#a678d6', label: 'Viola' },
  { hex: '#e88c3a', label: 'Arancione' },
  { hex: '#e57bab', label: 'Rosa' },
  { hex: '#cccccc', label: 'Grigio' }
];

let db = null;
let client = null;

async function connect() {
  if (db) return db;
  client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);

  // Create indexes
  await db.collection('notes').createIndex({ comicId: 1 });
  await db.collection('user_folders').createIndex(
    { name: 1, type: 1 },
    { unique: true }
  );

  // Seed default colors if empty
  const colorCount = await db.collection('user_colors').countDocuments();
  if (colorCount === 0) {
    const now = Date.now();
    await db.collection('user_colors').insertMany(
      DEFAULT_COLORS.map(c => ({ ...c, createdAt: now }))
    );
    console.log(`  Seeded ${DEFAULT_COLORS.length} default colors.`);
  }

  return db;
}

function getDb() {
  if (!db) throw new Error('Database not connected. Call connect() first.');
  return db;
}

async function close() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

module.exports = { connect, getDb, close, ObjectId };
