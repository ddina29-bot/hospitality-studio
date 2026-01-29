
import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

// --- PERSISTENCE (RAILWAY VOLUME) ---
// This is where the magic happens. Data is saved to the persistent volume.
const STORAGE_ROOT = process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname;
const DB_FILE = path.join(STORAGE_ROOT, 'database.json');
const UPLOADS_DIR = path.join(STORAGE_ROOT, 'uploads');

// Ensure storage exists
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ organizations: [] }, null, 2));
}

// Helper to read/write DB
const getDb = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
const saveDb = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// --- AUTH & ORGANIZATION ENDPOINTS ---

// 1. SIGN UP (Create New Organization)
app.post('/api/auth/signup', (req, res) => {
  const { adminUser, organization } = req.body;
  const db = getDb();

  // Check if email already exists globally
  const emailExists = db.organizations.some(org => 
    org.users.some(u => u.email.toLowerCase() === adminUser.email.toLowerCase())
  );

  if (emailExists) {
    return res.status(400).json({ error: 'Email already registered.' });
  }

  const newOrgId = `org-${Date.now()}`;
  
  const newOrganization = {
    id: newOrgId,
    settings: { ...organization },
    users: [{ ...adminUser, id: `admin-${Date.now()}`, role: 'admin', status: 'active' }],
    shifts: [],
    properties: [],
    clients: [],
    supplyRequests: [],
    inventoryItems: [],
    manualTasks: [],
    leaveRequests: [],
    invoices: [],
    tutorials: []
  };

  db.organizations.push(newOrganization);
  saveDb(db);

  res.json({ success: true, user: newOrganization.users[0], organization: newOrganization });
});

// 2. LOGIN (Find User & Org)
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body; 
  const db = getDb();

  let foundUser = null;
  let foundOrg = null;

  for (const org of db.organizations) {
    const user = org.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (user) {
      if (user.password === password || user.status === 'pending') { 
        foundUser = user;
        foundOrg = org;
        break;
      }
    }
  }

  if (!foundUser) return res.status(401).json({ error: 'Invalid credentials.' });
  if (foundUser.status === 'inactive') return res.status(403).json({ error: 'Account suspended.' });

  res.json({ success: true, user: foundUser, organization: foundOrg });
});

// 3. INVITE MEMBER
app.post('/api/auth/invite', (req, res) => {
  const { orgId, newUser } = req.body;
  const db = getDb();
  
  const orgIndex = db.organizations.findIndex(o => o.id === orgId);
  if (orgIndex === -1) return res.status(404).json({ error: 'Organization not found' });

  const userExists = db.organizations[orgIndex].users.find(u => u.email === newUser.email);
  if (userExists) return res.status(400).json({ error: 'User already exists in this studio.' });

  const createdUser = {
    ...newUser,
    id: `u-${Date.now()}`,
    status: 'pending',
    activationToken: Math.random().toString(36).substring(7) 
  };

  db.organizations[orgIndex].users.push(createdUser);
  saveDb(db);

  res.json({ success: true, user: createdUser, inviteLink: createdUser.activationToken });
});

// 4. VERIFY/ACTIVATE ACCOUNT
app.post('/api/auth/activate', (req, res) => {
  const { email, password, details } = req.body;
  const db = getDb();

  let foundOrgIndex = -1;
  let foundUserIndex = -1;

  db.organizations.forEach((org, oIdx) => {
    const uIdx = org.users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    if (uIdx > -1) {
      foundOrgIndex = oIdx;
      foundUserIndex = uIdx;
    }
  });

  if (foundOrgIndex === -1) return res.status(404).json({ error: 'User not found.' });

  const user = db.organizations[foundOrgIndex].users[foundUserIndex];
  if (user.status !== 'pending') return res.status(400).json({ error: 'Account already active.' });

  const updatedUser = {
    ...user,
    ...details,
    password: password, 
    status: 'active',
    activationDate: new Date().toISOString()
  };

  db.organizations[foundOrgIndex].users[foundUserIndex] = updatedUser;
  saveDb(db);

  res.json({ success: true, user: updatedUser, organization: db.organizations[foundOrgIndex] });
});

// --- DATA SYNC ---
app.post('/api/sync', (req, res) => {
  const { orgId, data } = req.body;
  const db = getDb();
  const orgIndex = db.organizations.findIndex(o => o.id === orgId);

  if (orgIndex === -1) return res.status(404).json({ error: 'Organization not found' });

  // Merge data
  const org = db.organizations[orgIndex];
  if(data.users) org.users = data.users;
  if(data.shifts) org.shifts = data.shifts;
  if(data.properties) org.properties = data.properties;
  if(data.clients) org.clients = data.clients;
  if(data.inventoryItems) org.inventoryItems = data.inventoryItems;
  if(data.manualTasks) org.manualTasks = data.manualTasks;
  if(data.supplyRequests) org.supplyRequests = data.supplyRequests;
  
  db.organizations[orgIndex] = org;
  saveDb(db);
  
  res.json({ success: true });
});

// --- FILE UPLOAD ---
app.use('/uploads', express.static(UPLOADS_DIR));

const diskStorage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, UPLOADS_DIR) },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext)
  }
});
const upload = multer({ storage: diskStorage, limits: { fileSize: 20 * 1024 * 1024 } });

app.post('/api/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file' });
    res.json({ url: `/uploads/${req.file.filename}` });
  });
});

// --- AI ---
let ai;
if (process.env.API_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
}
app.post('/api/chat', async (req, res) => {
  if (!ai) return res.status(503).json({ text: "AI Offline" });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: req.body.query,
    });
    res.json({ text: response.text });
  } catch (error) {
    res.status(500).json({ error: 'AI Error' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
