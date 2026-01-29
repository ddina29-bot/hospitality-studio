
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

// Load environment variables
dotenv.config();

// Configure paths for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Use the port provided by Railway/Host, or 3000 for local dev
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for JSON data

// Serve static files from the React build directory (dist)
app.use(express.static(path.join(__dirname, 'dist')));

// --- STORAGE CONFIGURATION ---

let upload;
const useCloudStorage = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;

if (useCloudStorage) {
  // Option A: Cloudinary Storage (Persistent on Railway)
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

  upload = multer({ storage: cloudStorage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

} else {
  // Option B: Local Disk Storage (Ephemeral on Railway, Persistent on Localhost)
  console.log("💾 Using Local Disk Storage for Uploads");

  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)){
      fs.mkdirSync(uploadsDir, { recursive: true });
  }
  // Serve uploaded files statically
  app.use('/uploads', express.static(uploadsDir));

  const diskStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      // Ensure directory exists right before saving
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

  upload = multer({ storage: diskStorage, limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB limit for local
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- API ENDPOINTS ---

// 1. Upload Endpoint
app.post('/api/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error("Upload Error:", err);
      return res.status(500).json({ error: err.message || 'File upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // If using Cloudinary, the file URL is in `req.file.path`.
    // If using Local, we construct the URL manually.
    const fileUrl = useCloudStorage ? req.file.path : `/uploads/${req.file.filename}`;
    
    res.json({ url: fileUrl });
  });
});

// 2. Chat Endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { query } = req.body;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: query,
      config: {
        systemInstruction: `You are RESET HOSPITALITY STUDIO AI, a sophisticated operations and HR assistant. 
        You help the hospitality studio team with company policies, schedules, and standard operating procedures (SOPs). 
        Your tone is premium, professional, and helpful.`,
      },
    });

    res.json({ text: response.text });
  } catch (error) {
    console.error('Backend AI Error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// 3. Database Sync Endpoint
const DB_FILE = path.join(__dirname, 'database.json');

app.post('/api/sync', (req, res) => {
  try {
    const data = req.body;
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true, timestamp: Date.now() });
  } catch (error) {
    console.error('DB Save Error:', error);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

app.get('/api/sync', (req, res) => {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      res.json(JSON.parse(data));
    } else {
      res.json(null); // No DB yet
    }
  } catch (error) {
    console.error('DB Load Error:', error);
    res.status(500).json({ error: 'Failed to load data' });
  }
});

// Catch-all handler: For any request that isn't an API call, serve the React App
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
