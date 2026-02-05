
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';
import nodemailer from 'nodemailer';
import Database from 'better-sqlite3';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

// --- SQLITE DATABASE SETUP ---
// Specifically targeting /app/data for persistent volumes as requested
let DATA_DIR = '/app/data';

if (!fs.existsSync(DATA_DIR)) {
  try {
    // Try to create the directory if it doesn't exist (useful for Docker/Local hybrid)
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    // Fallback to a local folder if /app/data is strictly read-only or unavailable (e.g., local windows dev)
    DATA_DIR = path.join(__dirname, 'data');
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Updated filename from studio.db to database.sqlite at the requested path
const DB_PATH = path.join(DATA_DIR, 'database.sqlite');
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    data TEXT
  )
`);

const saveOrgToDb = (org) => {
  const stmt = db.prepare('INSERT OR REPLACE INTO organizations (id, data) VALUES (?, ?)');
  stmt.run(org.id, JSON.stringify(org));
};

const getOrgById = (id) => {
  const row = db.prepare('SELECT data FROM organizations WHERE id = ?').get(id);
  return row ? JSON.parse(row.data) : null;
};

const findOrgByUserEmail = (email) => {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();
  const stmt = db.prepare('SELECT data FROM organizations');
  for (const row of stmt.iterate()) {
    const org = JSON.parse(row.data);
    if (org.users && org.users.some(u => u.email.toLowerCase() === cleanEmail)) {
      return org;
    }
  }
  return null;
};

// --- FILE STORAGE ---
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads'); 
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// SERVE THE UPLOADED FILES SO LINKS WORK
app.use('/uploads', express.static(UPLOADS_DIR));

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: diskStorage, limits: { fileSize: 25 * 1024 * 1024 } });

// --- ROUTES ---

app.post('/api/auth/signup', async (req, res) => {
  const { adminUser, organization } = req.body;
  const existingOrg = findOrgByUserEmail(adminUser.email);
  if (existingOrg) return res.status(400).json({ error: 'Email already registered.' });
  const newOrgId = `org-${Date.now()}`;
  const newOrg = { 
    id: newOrgId, 
    settings: organization, 
    users: [{ ...adminUser, id: `admin-${Date.now()}`, role: 'admin', status: 'active' }], 
    shifts: [], properties: [], clients: [], supplyRequests: [], inventoryItems: [], 
    manualTasks: [], leaveRequests: [], invoices: [], tutorials: [], timeEntries: [] 
  };
  saveOrgToDb(newOrg);
  res.json({ success: true, user: newOrg.users[0], organization: newOrg });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const org = findOrgByUserEmail(email);
  if (!org) return res.status(401).json({ error: 'User not found.' });
  const user = org.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (user.status !== 'pending' && user.password !== password) return res.status(401).json({ error: 'Invalid credentials.' });
  res.json({ success: true, user, organization: org });
});

app.get('/api/state', (req, res) => {
  const { email } = req.query;
  const org = findOrgByUserEmail(email);
  if (!org) return res.status(404).json({ error: 'Data not found.' });
  res.json({ success: true, organization: org });
});

app.post('/api/auth/invite', async (req, res) => {
  const { orgId, newUser } = req.body;
  const org = getOrgById(orgId);
  if (!org) return res.status(404).json({ error: 'Org not found.' });
  const createdUser = { ...newUser, id: `u-${Date.now()}`, status: 'pending', activationToken: Math.random().toString(36).substring(7) };
  org.users.push(createdUser);
  saveOrgToDb(org);
  res.json({ success: true, user: createdUser });
});

app.post('/api/sync', async (req, res) => {
  const { orgId, data } = req.body;
  const org = getOrgById(orgId);
  if (!org) {
    console.error(`Sync Fail: Org ${orgId} not found.`);
    return res.status(404).json({ error: "Org not found" });
  }
  
  // INTEGRITY CHECK: 
  // If the server has a large amount of properties/users and the incoming data is empty,
  // reject the sync as it is likely a race condition from a non-hydrated client.
  const isSuspicious = (org.properties && org.properties.length > 3 && (!data.properties || data.properties.length === 0));
  if (isSuspicious) {
    console.warn(`Sync blocked: Possible data wipe attempt detected for Org ${orgId}`);
    return res.status(422).json({ error: "Data integrity violation: client sent empty state for non-empty environment." });
  }

  // Merge data
  Object.keys(data).forEach(key => {
    org[key] = data[key];
  });
  
  saveOrgToDb(org);
  console.log(`Sync Success: Org ${orgId} updated at ${new Date().toLocaleTimeString()}`);
  res.json({ success: true });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
