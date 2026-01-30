
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
// Robustly determine the data directory.
let DATA_DIR;
if (process.env.RAILWAY_VOLUME_MOUNT_PATH) {
  DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH;
} else if (fs.existsSync('/app/data')) {
  DATA_DIR = '/app/data';
} else {
  DATA_DIR = path.join(__dirname, 'data');
}

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`[DB] Created data directory at ${DATA_DIR}`);
  } catch (e) {
    console.error(`[DB] Failed to create data directory at ${DATA_DIR}`, e);
    DATA_DIR = '/tmp/data';
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

const DB_PATH = path.join(DATA_DIR, 'studio.db');
const db = new Database(DB_PATH);

// Create the single table to store organizations
db.exec(`
  CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    data TEXT
  )
`);

console.log(`✅ Connected to SQLite Database at ${DB_PATH}`);

// --- HELPER FUNCTIONS ---

const saveOrgToDb = (org) => {
  try {
    const stmt = db.prepare('INSERT OR REPLACE INTO organizations (id, data) VALUES (?, ?)');
    stmt.run(org.id, JSON.stringify(org));
  } catch (err) {
    console.error(`[DB ERROR] Failed to save org ${org.id}:`, err);
    throw err;
  }
};

const getOrgById = (id) => {
  try {
    const row = db.prepare('SELECT data FROM organizations WHERE id = ?').get(id);
    return row ? JSON.parse(row.data) : null;
  } catch (err) {
    console.error(`[DB ERROR] Failed to get org ${id}:`, err);
    return null;
  }
};

const findOrgByUserEmail = (email) => {
  try {
    const stmt = db.prepare('SELECT data FROM organizations');
    for (const row of stmt.iterate()) {
      const org = JSON.parse(row.data);
      if (org.users && org.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        return org;
      }
    }
  } catch (e) {
    console.error("Error searching DB:", e);
  }
  return null;
};

// --- SEEDING MAIN ADMIN (AGGRESSIVE) ---
const seedMainAdmin = () => {
  const targetEmail = 'ddina29@gmail.com';
  const targetPassword = 'SrecaVreca1';
  
  const existingOrg = findOrgByUserEmail(targetEmail);
  
  if (existingOrg) {
    console.log(`[SEED] Found existing org for ${targetEmail}. Ensuring Admin Access...`);
    // Force update the user to be active and have the correct password/role
    let userFound = false;
    existingOrg.users = existingOrg.users.map(u => {
        if (u.email.toLowerCase() === targetEmail.toLowerCase()) {
            userFound = true;
            return { 
                ...u, 
                status: 'active', 
                password: targetPassword, 
                role: 'admin',
                activationToken: null // Clear any pending invites
            };
        }
        return u;
    });
    
    // If for some reason email matches but user wasn't found in map (edge case), add them
    if (!userFound) {
         existingOrg.users.push({
            id: `admin-main-${Date.now()}`,
            name: 'Dina (Main Admin)',
            email: targetEmail,
            password: targetPassword,
            role: 'admin',
            status: 'active',
            hasID: true,
            hasContract: true,
            activationDate: new Date().toISOString()
         });
    }
    
    saveOrgToDb(existingOrg);
    console.log(`[SEED] ✅ Admin access restored for ${targetEmail}`);
    return;
  }

  console.log(`[SEED] Creating NEW Org for Main Admin: ${targetEmail}`);
  
  // Use a STATIC ID so local storage remains valid across restarts
  const newOrgId = `org-seed-main`;
  const newAdminId = `admin-main`;
  
  const newOrg = {
    id: newOrgId,
    settings: {
      name: 'RESET HOSPITALITY STUDIO',
      address: 'Malta',
      email: targetEmail,
      phone: '',
      website: '',
      legalEntity: 'Reset Hospitality',
      taxId: ''
    },
    users: [{
      id: newAdminId,
      name: 'Dina (Main Admin)',
      email: targetEmail,
      password: targetPassword,
      role: 'admin',
      status: 'active',
      hasID: true,
      hasContract: true,
      activationDate: new Date().toISOString()
    }],
    shifts: [], properties: [], clients: [], supplyRequests: [], 
    inventoryItems: [], manualTasks: [], leaveRequests: [], invoices: [], tutorials: [],
    timeEntries: [] 
  };
  
  saveOrgToDb(newOrg);
  console.log(`[SEED] ✅ Main Admin created successfully.`);
};

// Run seed on startup
seedMainAdmin();

// --- FILE STORAGE (Images) ---
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads'); 
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

app.get('/api/system/status', (req, res) => {
  const isPersistent = DATA_DIR.startsWith('/app/data') || !!process.env.RAILWAY_VOLUME_MOUNT_PATH;
  res.json({
    storagePath: DATA_DIR,
    persistenceActive: isPersistent,
    uploadsPath: UPLOADS_DIR,
    version: '3.2.5'
  });
});

// GET ORGANIZATION DATA (New Endpoint for Refresh)
app.get('/api/organization/:orgId', (req, res) => {
  const { orgId } = req.params;
  const org = getOrgById(orgId);
  if (!org) return res.status(404).json({ error: 'Organization not found' });
  res.json(org);
});

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
    const newOrg = {
      id: newOrgId,
      settings: { ...organization },
      users: [{ ...adminUser, id: newAdminId, role: 'admin', status: 'active' }],
      shifts: [], properties: [], clients: [], supplyRequests: [], 
      inventoryItems: [], manualTasks: [], leaveRequests: [], invoices: [], tutorials: [],
      timeEntries: [] 
    };
    saveOrgToDb(newOrg);
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
    
    if (user.status !== 'pending' && user.password !== password) {
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
    
    // Email logic (Optional - we prioritize returning the link)
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
    const inviteLink = user.activationToken;
    const activationUrl = `${req.protocol}://${req.get('host')}/?code=${inviteLink}`;
    let emailSent = false;
    const transporter = createTransporter();
    if (transporter) {
      try {
        await transporter.sendMail({
          from: `"Reset Studio" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
          to: email,
          subject: "Invitation Reminder",
          html: `<p>Reminder to join.</p><p><a href="${activationUrl}">Click here to activate</a></p>`
        });
        emailSent = true;
      } catch (e) { console.error("Email error:", e); }
    }
    res.json({ success: true, emailSent, inviteLink: activationUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resend invite.' });
  }
});

// 3.5 VERIFY INVITE
app.get('/api/auth/verify-invite', (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing code' });
    const stmt = db.prepare('SELECT data FROM organizations');
    for (const row of stmt.iterate()) {
      try {
        const org = JSON.parse(row.data);
        const user = org.users?.find(u => u.activationToken === code && u.status === 'pending');
        if (user) {
          return res.json({ email: user.email, name: user.name });
        }
      } catch (parseErr) {}
    }
    res.status(404).json({ error: 'Invalid or expired activation link' });
  } catch (error) {
    res.status(500).json({ error: 'Verification error' });
  }
});

// 4. ACTIVATE USER
app.post('/api/auth/activate', async (req, res) => {
  const { email, password, details } = req.body;
  try {
    const org = findOrgByUserEmail(email);
    if (!org) return res.status(404).json({ error: 'User not found.' });
    const userIndex = org.users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (org.users[userIndex].status === 'active') {
        return res.status(400).json({ error: 'Account already active. Please login.' });
    }

    org.users[userIndex] = {
      ...org.users[userIndex],
      ...details,
      password: password,
      status: 'active',
      activationDate: new Date().toISOString(),
      activationToken: null
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
  try {
    const stmt = db.prepare('DELETE FROM organizations WHERE id = ?');
    const info = stmt.run(orgId);
    if (info.changes === 0) return res.status(404).json({ error: 'Organization not found.' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete organization.' });
  }
});

// 5.5 RESET OPERATIONAL DATA (Clear Testing Data)
app.post('/api/admin/reset-data', async (req, res) => {
  const { orgId } = req.body;
  try {
    const org = getOrgById(orgId);
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    // Clear operational arrays but keep Users, Properties, Clients and Settings
    org.shifts = [];
    org.manualTasks = [];
    org.supplyRequests = [];
    org.invoices = [];
    org.leaveRequests = [];
    org.timeEntries = [];
    
    saveOrgToDb(org);
    console.log(`[RESET] Cleared operational data for Org ${orgId}`);
    res.json({ success: true, organization: org });
  } catch (error) {
    console.error("Reset Error:", error);
    res.status(500).json({ error: "Failed to reset data." });
  }
});

// 6. SYNC DATA (The main engine with Smart Merge)
app.post('/api/sync', async (req, res) => {
  const { orgId, data } = req.body;
  if (!orgId) return res.status(400).json({ error: "Missing OrgId" });

  try {
    const org = getOrgById(orgId);
    if (!org) return res.status(404).json({ error: "Organization not found" });

    // --- SMART MERGE LOGIC FOR USERS ---
    if (data.users && Array.isArray(data.users)) {
        const dbUsersMap = new Map((org.users || []).map(u => [u.id, u]));
        data.users.forEach(incomingUser => {
            const existingUser = dbUsersMap.get(incomingUser.id);
            if (existingUser) {
                // Don't overwrite active with pending
                if (existingUser.status === 'active' && incomingUser.status === 'pending') return; 
                // Preserve passwords
                if (existingUser.password && !incomingUser.password) incomingUser.password = existingUser.password;
                dbUsersMap.set(incomingUser.id, incomingUser);
            } else {
                dbUsersMap.set(incomingUser.id, incomingUser);
            }
        });
        org.users = Array.from(dbUsersMap.values());
    }

    // Direct merge for operational data (Last Write Wins from active Client)
    if (data.shifts) org.shifts = data.shifts; 
    if (data.properties) org.properties = data.properties;
    if (data.clients) org.clients = data.clients;
    if (data.inventoryItems) org.inventoryItems = data.inventoryItems;
    if (data.manualTasks) org.manualTasks = data.manualTasks;
    if (data.supplyRequests) org.supplyRequests = data.supplyRequests;
    if (data.settings) org.settings = data.settings;
    if (data.invoices) org.invoices = data.invoices;
    if (data.timeEntries) org.timeEntries = data.timeEntries;
    if (data.leaveRequests) org.leaveRequests = data.leaveRequests;
    if (data.tutorials) org.tutorials = data.tutorials;

    saveOrgToDb(org);
    console.log(`[SYNC] Updated Org ${orgId}. Props: ${org.properties?.length}, Clients: ${org.clients?.length}`);
    res.json({ success: true });
  } catch (error) {
    console.error("Sync Error:", error);
    res.status(500).json({ error: "Sync failed" });
  }
});

// 7. FILE UPLOAD
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
    const response = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: req.body.query });
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
  console.log(`Storage location: ${DATA_DIR}`);
});
