
import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';
import nodemailer from 'nodemailer';

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
const STORAGE_ROOT = process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname;
const DB_FILE = path.join(STORAGE_ROOT, 'database.json');
const UPLOADS_DIR = path.join(STORAGE_ROOT, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ organizations: [] }, null, 2));
}

const getDb = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
const saveDb = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// --- EMAIL TRANSPORTER SETUP ---
// Configures only if environment variables are present
const createTransporter = () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return null;
};

// --- AUTH & ORGANIZATION ENDPOINTS ---

app.post('/api/auth/signup', (req, res) => {
  const { adminUser, organization } = req.body;
  const db = getDb();

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

app.post('/api/auth/invite', async (req, res) => {
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

  const inviteLink = createdUser.activationToken;
  const activationUrl = `${req.protocol}://${req.get('host')}/login?code=${inviteLink}`;
  
  // Try sending real email
  let emailSent = false;
  const transporter = createTransporter();
  
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Reset Studio" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: newUser.email,
        subject: "Action Required: Reset Hospitality Studio Access",
        html: `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff; border: 1px solid #e5e5e5;">
            <div style="text-align: center; margin-bottom: 30px;">
               <h1 style="color: #000; font-size: 24px; text-transform: uppercase; letter-spacing: 4px; margin: 0;">Reset</h1>
               <span style="color: #C5A059; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; font-weight: bold;">Hospitality Studio</span>
            </div>
            
            <div style="background-color: #FDF8EE; padding: 30px; border-left: 4px solid #C5A059;">
              <h2 style="color: #000; font-size: 18px; margin-top: 0; margin-bottom: 15px;">Welcome to the Team</h2>
              <p style="font-size: 14px; line-height: 1.6; color: #4a4a4a; margin-bottom: 20px;">
                You have been invited to join the <strong>Reset Hospitality Studio</strong> platform. As a member of our team, you will use this portal to manage your shifts, tasks, and reports.
              </p>
              <div style="text-align: center; margin: 35px 0;">
                <a href="${activationUrl}" style="background-color: #000000; color: #C5A059; font-weight: bold; text-decoration: none; padding: 16px 32px; border-radius: 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; display: inline-block;">Setup Your Account</a>
              </div>
              <p style="font-size: 12px; color: #888; line-height: 1.5; text-align: center;">
                If the button above does not work, copy and paste this link into your browser:<br/>
                <a href="${activationUrl}" style="color: #C5A059; text-decoration: none;">${activationUrl}</a>
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
              <p style="font-size: 10px; color: #aaa; text-transform: uppercase; letter-spacing: 1px;">© Reset Hospitality Studio. Automated System Message.</p>
            </div>
          </div>
        `
      });
      emailSent = true;
      console.log(`Email sent successfully to ${newUser.email}`);
    } catch (error) {
      console.error("Failed to send email:", error);
      // We don't fail the request, we just fallback to returning the link for manual sharing
    }
  }

  res.json({ success: true, user: createdUser, inviteLink: inviteLink, emailSent });
});

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

// NEW ENDPOINT: Delete Organization
app.post('/api/auth/delete-organization', (req, res) => {
  const { orgId } = req.body;
  const db = getDb();
  
  const initialLength = db.organizations.length;
  db.organizations = db.organizations.filter(o => o.id !== orgId);

  if (db.organizations.length === initialLength) {
    return res.status(404).json({ error: 'Organization not found' });
  }

  saveDb(db);
  res.json({ success: true });
});

app.post('/api/sync', (req, res) => {
  const { orgId, data } = req.body;
  const db = getDb();
  const orgIndex = db.organizations.findIndex(o => o.id === orgId);

  if (orgIndex === -1) return res.status(404).json({ error: 'Organization not found' });

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
