
import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import mongoose from 'mongoose';

// Load environment variables
dotenv.config();

// Configure paths for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve static files from the React build directory (dist)
app.use(express.static(path.join(__dirname, 'dist')));

// --- PERSISTENCE CONFIGURATION (RAILWAY VOLUME) ---
// If RAILWAY_VOLUME_MOUNT_PATH is set (e.g., /app/data), we use that.
// Otherwise, we fallback to the current directory (local development).
const STORAGE_ROOT = process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname;
const DB_FILE = path.join(STORAGE_ROOT, 'database.json');

console.log(`💾 Data Storage Path: ${STORAGE_ROOT}`);
console.log(`📄 Database File: ${DB_FILE}`);

// --- MONGODB CONNECTION (Optional Backup) ---
const MONGO_URL = process.env.MONGO_URL || process.env.MONGODB_URI;
let isMongoConnected = false;

if (MONGO_URL) {
  mongoose.connect(MONGO_URL)
    .then(() => {
      console.log('✅ Connected to MongoDB');
      isMongoConnected = true;
    })
    .catch(err => console.error('❌ MongoDB Connection Error:', err));
}

// Define a unified schema for the entire application state
const StudioSchema = new mongoose.Schema({
  identifier: { type: String, default: 'main_studio' }, // Singleton identifier
  users: { type: Array, default: [] },
  shifts: { type: Array, default: [] },
  properties: { type: Array, default: [] },
  clients: { type: Array, default: [] },
  supplyRequests: { type: Array, default: [] },
  inventoryItems: { type: Array, default: [] },
  manualTasks: { type: Array, default: [] },
  leaveRequests: { type: Array, default: [] },
  invoices: { type: Array, default: [] },
  tutorials: { type: Array, default: [] },
  organization: { type: Object, default: {} },
  lastUpdated: { type: Date, default: Date.now }
});

const StudioModel = mongoose.model('StudioData', StudioSchema);

// --- STORAGE CONFIGURATION ---

let upload;
const useCloudStorage = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;

if (useCloudStorage) {
  console.log("☁️  Using Cloudinary Storage for Uploads");
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  const cloudStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'reset-studio-uploads',
      allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    },
  });
  upload = multer({ storage: cloudStorage, limits: { fileSize: 10 * 1024 * 1024 } });
} else {
  // If not using Cloudinary, save uploads to the Persistent Volume
  console.log("💾 Using Disk Storage for Uploads");
  
  const uploadsDir = path.join(STORAGE_ROOT, 'uploads');
  
  if (!fs.existsSync(uploadsDir)){
      fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  // Important: We need to serve this folder publicly
  app.use('/uploads', express.static(uploadsDir));
  
  const diskStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      if (!fs.existsSync(uploadsDir)){
          fs.mkdirSync(uploadsDir, { recursive: true });
      }
      cb(null, uploadsDir)
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
      const ext = path.extname(file.originalname);
      cb(null, file.fieldname + '-' + uniqueSuffix + ext)
    }
  });
  upload = multer({ storage: diskStorage, limits: { fileSize: 20 * 1024 * 1024 } });
}

// --- AI CONFIGURATION ---
let ai;
if (process.env.API_KEY) {
  try {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  } catch (error) {
    console.error("Failed to initialize GoogleGenAI:", error);
  }
} else {
  console.warn("⚠️ API_KEY is missing. AI features will be disabled.");
}

// --- API ENDPOINTS ---

app.post('/api/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(500).json({ error: err.message || 'File upload failed' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    // If using disk storage, construct the URL relative to the server
    const fileUrl = useCloudStorage 
      ? req.file.path 
      : `/uploads/${req.file.filename}`;
      
    res.json({ url: fileUrl });
  });
});

app.post('/api/chat', async (req, res) => {
  if (!ai) {
    console.error('AI Request failed: API_KEY not set');
    return res.status(503).json({ text: "System Notice: AI capabilities are currently offline. Please contact the administrator to configure the API Key." });
  }
  try {
    const { query } = req.body;
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: query,
      config: {
        systemInstruction: `You are RESET HOSPITALITY STUDIO AI, a sophisticated operations assistant.`,
      },
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error('Backend AI Error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// --- DATA SYNC ENDPOINTS ---

app.post('/api/sync', async (req, res) => {
  const data = req.body;
  
  if (isMongoConnected) {
    try {
      // Upsert: Update if exists, Insert if not
      await StudioModel.findOneAndUpdate(
        { identifier: 'main_studio' }, 
        { ...data, lastUpdated: new Date() }, 
        { upsert: true, new: true }
      );
      res.json({ success: true, mode: 'mongo' });
    } catch (err) {
      console.error('Mongo Save Error:', err);
      res.status(500).json({ error: 'Database Write Failed' });
    }
  } else {
    // Fallback to file system (Persistent Volume if configured)
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
      res.json({ success: true, mode: 'disk', path: DB_FILE });
    } catch (error) {
      console.error('DB Save Error:', error);
      res.status(500).json({ error: 'Failed to save data' });
    }
  }
});

app.get('/api/sync', async (req, res) => {
  if (isMongoConnected) {
    try {
      const doc = await StudioModel.findOne({ identifier: 'main_studio' });
      res.json(doc || null);
    } catch (err) {
      console.error('Mongo Fetch Error:', err);
      res.status(500).json({ error: 'Database Read Failed' });
    }
  } else {
    try {
      if (fs.existsSync(DB_FILE)) {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        res.json(JSON.parse(data));
      } else {
        res.json(null);
      }
    } catch (error) {
      console.error('DB Load Error:', error);
      res.status(500).json({ error: 'Failed to load data' });
    }
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
