
import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
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
// Increase limit to handle syncing large organization state
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

// --- SQLITE DATABASE SETUP ---
// We use a persistent volume path if available (Railway), otherwise local 'data' folder
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`[DB] Created data directory at ${DATA_DIR}`);
}

const DB_PATH = path.join(DATA_DIR, 'studio.db');
const db = new Database(DB_PATH);

// Create the single table to store organizations
// We store the entire organization object as a JSON string in the 'data' column
db.exec(`
  CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    data TEXT
  )
`);

console.log(`✅ Connected to SQLite Database at ${DB_PATH}`);

// --- HELPER FUNCTIONS ---

// Helper to save org data
const saveOrgToDb = (org) => {
  const stmt = db.prepare('INSERT OR REPLACE INTO organizations (id, data) VALUES (?, ?)');
  stmt.run(org.id, JSON.stringify(org));
};

// Helper to get org by ID
const getOrgById = (id) => {
  const row = db.prepare('SELECT data FROM organizations WHERE id = ?').get(id);
  return row ? JSON.parse(row.data) : null;
};

// Helper to find org by user email (Scan all orgs - okay for <1000 orgs)
const findOrgByUserEmail = (email) => {
  const stmt = db.prepare('SELECT data FROM organizations');
  for (const row of stmt.iterate()) {
    const org = JSON.parse(row.data);
    if (org.users && org.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return org;
    }
  }
  return null;
};

// --- FILE STORAGE (Images) ---
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads'); // Store uploads in the persistent volume too

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const diskStorage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, UPLOADS_DIR) },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext)
  }
});
const upload = multer({ storage: diskStorage, limits: { fileSize: 25 * 1024 * 1024 } });

// --- EMAILER ---
const createTransporter = () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return null;
};

// --- ROUTES ---

// 1. SIGNUP
app.post('/api/auth/signup', async (req, res) => {
  const { adminUser, organization } = req.body;

  try {
    const existingOrg = findOrgByUserEmail(adminUser.email);
    if (existingOrg) {
      return res.status(400).json({ error: 'This email is already registered to an organization.' });
    }

    const newOrgId = `org-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const newAdminId = `admin-${Date.now()}`;

    // Create the full object structure
    const newOrg = {
      id: newOrgId,
      settings: { ...organization },
      users: [{ ...adminUser, id: newAdminId, role: 'admin', status: 'active' }],
      shifts: [], properties: [], clients: [], supplyRequests: [], 
      inventoryItems: [], manualTasks: [], leaveRequests: [], invoices: [], tutorials: [],
      timeEntries: [] 
    };

    saveOrgToDb(newOrg);
    console.log(`[DB] Created new organization: ${newOrg.id}`);

    res.json({ success: true, user: newOrg.users[0], organization: newOrg });
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ error: 'Database error during signup.' });
  }
});

// 2. LOGIN
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const org = findOrgByUserEmail(email);
    
    if (!org) return res.status(401).json({ error: 'User not found.' });

    const user = org.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (user.password !== password && user.status !== 'pending') {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    if (user.status === 'inactive') return res.status(403).json({ error: 'Account suspended.' });

    res.json({ success: true, user: user, organization: org });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: 'Database error.' });
  }
});

// 3. INVITE USER
app.post('/api/auth/invite', async (req, res) => {
  const { orgId, newUser } = req.body;

  try {
    const org = getOrgById(orgId);
    if (!org) return res.status(404).json({ error: 'Organization not found.' });

    const globalCheck = findOrgByUserEmail(newUser.email);
    if (globalCheck) return res.status(400).json({ error: 'User email already exists in the system.' });

    const createdUser = {
      ...newUser,
      id: `u-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      status: 'pending',
      activationToken: Math.random().toString(36).substring(7)
    };

    org.users.push(createdUser);
    saveOrgToDb(org);

    const inviteLink = createdUser.activationToken;
    const activationUrl = `${req.protocol}://${req.get('host')}/?code=${inviteLink}`;

    let emailSent = false;
    const transporter = createTransporter();
    if (transporter) {
      try {
        await transporter.sendMail({
          from: `"Reset Studio" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
          to: newUser.email,
          subject: "Invitation to Reset Studio",
          html: `<p>You have been invited to join Reset Studio.</p><p><a href="${activationUrl}">Click here to activate your account</a></p>`
        });
        emailSent = true;
      } catch (e) { console.error("Email error:", e); }
    }

    res.json({ success: true, user: createdUser, inviteLink: activationUrl, emailSent });
  } catch (error) {
    console.error("Invite Error:", error);
    res.status(500).json({ error: 'Failed to invite user.' });
  }
});

// 3.1 RESEND INVITE
app.post('/api/auth/resend-invite', async (req, res) => {
  const { email } = req.body;
  try {
    const org = findOrgByUserEmail(email);
    if (!org) return res.status(404).json({ error: 'User not found.' });

    const user = org.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user || user.status !== 'pending') return res.status(400).json({ error: 'User is active or not pending.' });

    // Use existing token
    const inviteLink = user.activationToken;
    if (!inviteLink) return res.status(400).json({ error: 'No activation token found.' });

    const activationUrl = `${req.protocol}://${req.get('host')}/?code=${inviteLink}`;
    let emailSent = false;
    
    const transporter = createTransporter();
    if (transporter) {
      try {
        await transporter.sendMail({
          from: `"Reset Studio" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
          to: email,
          subject: "Invitation Reminder: Reset Studio",
          html: `<p>This is a reminder to join Reset Studio.</p><p><a href="${activationUrl}">Click here to activate your account</a></p>`
        });
        emailSent = true;
      } catch (e) { console.error("Email error:", e); }
    }

    res.json({ success: true, emailSent, inviteLink: activationUrl });
  } catch (error) {
    console.error("Resend Invite Error:", error);
    res.status(500).json({ error: 'Failed to resend invite.' });
  }
});

// 3.5 VERIFY INVITE (New)
app.get('/api/auth/verify-invite', (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing code' });

    const stmt = db.prepare('SELECT data FROM organizations');
    for (const row of stmt.iterate()) {
      try {
        const org = JSON.parse(row.data);
        if (!org.users || !Array.isArray(org.users)) continue;

        const user = org.users.find(u => u.activationToken === code && u.status === 'pending');
        if (user) {
          return res.json({ email: user.email, name: user.name });
        }
      } catch (parseErr) {
        console.error("Error parsing DB row during verification:", parseErr);
        continue;
      }
    }
    res.status(404).json({ error: 'Invalid or expired activation link' });
  } catch (error) {
    console.error("Verify Invite Error:", error);
    res.status(500).json({ error: 'Internal server error during verification' });
  }
});

// 4. ACTIVATE USER
app.post('/api/auth/activate', async (req, res) => {
  const { email, password, details } = req.body;

  try {
    const org = findOrgByUserEmail(email);
    if (!org) return res.status(404).json({ error: 'User not found.' });

    const userIndex = org.users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (org.users[userIndex].status !== 'pending') {
      return res.status(400).json({ error: 'Account already active.' });
    }

    org.users[userIndex] = {
      ...org.users[userIndex],
      ...details,
      password: password,
      status: 'active',
      activationDate: new Date().toISOString(),
      activationToken: null // Clear token
    };

    saveOrgToDb(org);

    res.json({ success: true, user: org.users[userIndex], organization: org });
  } catch (error) {
    res.status(500).json({ error: 'Activation failed.' });
  }
});

// 5. DELETE ORGANIZATION
app.post('/api/auth/delete-organization', async (req, res) => {
  const { orgId } = req.body;
  console.log(`[DELETE] Attempting to delete Org: ${orgId}`);

  try {
    const stmt = db.prepare('DELETE FROM organizations WHERE id = ?');
    const info = stmt.run(orgId);
    
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Organization not found.' });
    }
    console.log(`[DELETE] Success.`);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ error: 'Failed to delete organization.' });
  }
});

// 9. NUKE SYSTEM (Emergency Reset)
app.post('/api/auth/nuke-system', async (req, res) => {
  try {
    db.exec('DELETE FROM organizations');
    console.log('[DB] System Nuked. All organizations deleted.');
    res.json({ success: true, message: 'System reset complete.' });
  } catch (error) {
    console.error("Nuke Error:", error);
    res.status(500).json({ error: 'Failed to reset system.' });
  }
});

// 6. SYNC DATA (The main engine)
app.post('/api/sync', async (req, res) => {
  const { orgId, data } = req.body;
  if (!orgId) return res.status(400).json({ error: "Missing OrgId" });

  try {
    const org = getOrgById(orgId);
    if (!org) return res.status(404).json({ error: "Organization not found" });

    // Merge incoming data with existing org data
    if (data.users) org.users = data.users;
    if (data.shifts) org.shifts = data.shifts;
    if (data.properties) org.properties = data.properties;
    if (data.clients) org.clients = data.clients;
    if (data.inventoryItems) org.inventoryItems = data.inventoryItems;
    if (data.manualTasks) org.manualTasks = data.manualTasks;
    if (data.supplyRequests) org.supplyRequests = data.supplyRequests;
    if (data.organization) org.settings = data.organization;
    if (data.invoices) org.invoices = data.invoices;
    if (data.timeEntries) org.timeEntries = data.timeEntries;

    saveOrgToDb(org);

    res.json({ success: true });
  } catch (error) {
    console.error("Sync Error:", error);
    res.status(500).json({ error: "Sync failed" });
  }
});

// 7. FILE UPLOAD
// Serve uploads from the persistent data directory
app.use('/uploads', express.static(UPLOADS_DIR));

app.post('/api/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ url: `/uploads/${req.file.filename}` });
  });
});

// 8. AI CHAT
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

// Serve Frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Storage location: ${DATA_DIR}`);
});
