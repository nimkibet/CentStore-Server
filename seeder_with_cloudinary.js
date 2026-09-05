import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import connectDB from './src/config/db.js';
import Product from './src/models/Product.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration for local files and fallback urls
const uploadsDir = path.join(__dirname, 'public', 'uploads', 'products');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 15 high-quality free stock smartphone images from Unsplash to use as fallbacks
const fallbackImages = [
  "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1580910051074-3eb694886505?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1565849904461-09a2843a0e51?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1523206489230-c012c54b2b48?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1573148195900-7845dcb9b127?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1557180295-76eee20ae8aa?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1533228893047-ef8879ec3b51?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1585060544812-6b45742d762f?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1592890288564-7662c2f0ade3?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1565849904461-09a2843a0e51?w=600&auto=format&fit=crop&q=80"
];

// Simple hash function to select fallback image deterministically
const getFallbackImage = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % fallbackImages.length;
  return fallbackImages[idx];
};

// Search Bing Images for a search term
const searchBingImage = (query) => {
  return new Promise((resolve) => {
    const encoded = encodeURIComponent(query);
    const url = `https://www.bing.com/images/search?q=${encoded}`;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const murls = [...data.matchAll(/murl&quot;:&quot;(https?:\/\/[^&"]+)&quot;/g)].map(m => m[1]);
        if (murls.length > 0) {
          resolve(murls[0]);
        } else {
          resolve(null);
        }
      });
    }).on('error', (err) => {
      console.warn(`[Search Error] Failed searching Bing for "${query}": ${err.message}`);
      resolve(null);
    });
  });
};

// Download an image from a URL
const downloadImage = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const options = {
      rejectUnauthorized: false,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    };
    https.get(url, options, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: status ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(true);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
};

const rawProductsList = [
  { "brand": "Apple", "model": "iPhone XR", "storage": "128GB", "ram": null, "price_kes": 25000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "Apple", "model": "iPhone XR", "storage": "256GB", "ram": null, "price_kes": 28500, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "Apple", "model": "iPhone 11", "storage": "64GB", "ram": null, "price_kes": 26000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "Apple", "model": "iPhone 11 Pro", "storage": "256GB", "ram": null, "price_kes": 34000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "Apple", "model": "iPhone 11 Pro Max", "storage": "256GB", "ram": null, "price_kes": 38000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "Apple", "model": "iPhone 12", "storage": "128GB", "ram": null, "price_kes": 32000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "Apple", "model": "iPhone 12 Pro", "storage": "128GB", "ram": null, "price_kes": 37000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "Apple", "model": "iPhone 12 Pro", "storage": "256GB", "ram": null, "price_kes": 40000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "Apple", "model": "iPhone 12 Pro Max", "storage": "256GB", "ram": null, "price_kes": 48000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "Apple", "model": "iPhone 13", "storage": "128GB", "ram": null, "price_kes": 41000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "Apple", "model": "iPhone 13 Pro", "storage": "128GB", "ram": null, "price_kes": 52000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "Apple", "model": "iPhone 13 Pro", "storage": "256GB", "ram": null, "price_kes": 54000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "Apple", "model": "iPhone 13 Pro Max", "storage": "256GB", "ram": null, "price_kes": 67000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "Apple", "model": "iPhone 13 Pro Max", "storage": "512GB", "ram": null, "price_kes": 72000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "Apple", "model": "iPhone 14", "storage": "128GB", "ram": null, "price_kes": 50000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "Apple", "model": "iPhone 14 Pro", "storage": "128GB", "ram": null, "price_kes": 63000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "Apple", "model": "iPhone 14 Pro", "storage": "256GB", "ram": null, "price_kes": 65000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "Apple", "model": "iPhone 14 Pro Max", "storage": "256GB", "ram": null, "price_kes": 76000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "Apple", "model": "iPhone 15", "storage": "256GB", "ram": null, "price_kes": 64000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "Apple", "model": "iPhone 15 Pro", "storage": "256GB", "ram": null, "price_kes": 87000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "Apple", "model": "iPhone 15 Pro Max", "storage": "256GB", "ram": null, "price_kes": 99000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "Apple", "model": "iPhone 16 Pro", "storage": "256GB", "ram": null, "price_kes": 115000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "Apple", "model": "iPhone 16 Pro Max", "storage": "256GB", "ram": null, "price_kes": 120000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "Apple", "model": "iPhone 17", "storage": "256GB", "ram": null, "price_kes": 118000, "sim_type": "Physical SIM", "source_platform": "WhatsApp" },
  { "brand": "Apple", "model": "iPhone 17 Pro", "storage": "256GB", "ram": null, "price_kes": 179000, "sim_type": "Physical SIM", "source_platform": "WhatsApp" },
  { "brand": "Apple", "model": "iPhone 17 Pro Max", "storage": "256GB", "ram": null, "price_kes": 200000, "sim_type": "Physical SIM", "source_platform": "WhatsApp" },
  { "brand": "Apple", "model": "iPhone 17", "storage": "256GB", "ram": null, "price_kes": 112000, "sim_type": "eSIM", "source_platform": "WhatsApp" },
  { "brand": "Apple", "model": "iPhone 17 Air", "storage": "256GB", "ram": null, "price_kes": 127000, "sim_type": "eSIM", "source_platform": "WhatsApp" },
  { "brand": "Apple", "model": "iPhone 17 Pro", "storage": "256GB", "ram": null, "price_kes": 165000, "sim_type": "eSIM", "source_platform": "WhatsApp" },
  { "brand": "Apple", "model": "iPhone 17 Pro Max", "storage": "256GB", "ram": null, "price_kes": 177000, "sim_type": "eSIM", "source_platform": "WhatsApp" },
  { "brand": "Xiaomi", "model": "Redmi A7 Pro", "storage": "128GB", "ram": "4GB", "price_kes": 16000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "Xiaomi", "model": "Redmi 15C", "storage": "256GB", "ram": "8GB", "price_kes": 22000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "Xiaomi", "model": "Redmi 15", "storage": "256GB", "ram": "8GB", "price_kes": 25000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "Xiaomi", "model": "Redmi Note 15 Pro", "storage": "256GB", "ram": "8GB", "price_kes": 37000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "Xiaomi", "model": "Redmi Note 15 Pro 5G", "storage": "256GB", "ram": "8GB", "price_kes": 39000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "OnePlus", "model": "OnePlus Nord 5", "storage": "512GB", "ram": "12GB", "price_kes": 57000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "OnePlus", "model": "OnePlus 13S", "storage": "256GB", "ram": "12GB", "price_kes": 66000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "OnePlus", "model": "OnePlus 13", "storage": "512GB", "ram": "16GB", "price_kes": 94000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "OnePlus", "model": "OnePlus 15", "storage": "512GB", "ram": "16GB", "price_kes": 113000, "sim_type": "Standard", "source_platform": "WhatsApp" },
  { "brand": "Samsung", "model": "Galaxy A13", "storage": "128GB", "ram": "4GB", "price_kes": 12500, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy A24", "storage": "128GB", "ram": "4GB", "price_kes": 16000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy A23", "storage": "128GB", "ram": "4GB", "price_kes": 16000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy A05", "storage": "128GB", "ram": "4GB", "price_kes": 15000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy A07", "storage": "128GB", "ram": "4GB", "price_kes": 14000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy A16", "storage": "128GB", "ram": "4GB", "price_kes": 19500, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy A17", "storage": "256GB", "ram": "8GB", "price_kes": 20000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy A25", "storage": "128GB", "ram": "6GB", "price_kes": 19000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy A26", "storage": "128GB", "ram": "6GB", "price_kes": 29000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy A34", "storage": "128GB", "ram": "8GB", "price_kes": 19000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy A36", "storage": "128GB", "ram": "8GB", "price_kes": 36000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy A37", "storage": "256GB", "ram": "8GB", "price_kes": 57000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy A53", "storage": "128GB", "ram": "8GB", "price_kes": 21500, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy A54", "storage": "128GB", "ram": "8GB", "price_kes": 25500, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy A56", "storage": "256GB", "ram": "12GB", "price_kes": 55000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy A57", "storage": "256GB", "ram": "8GB", "price_kes": 63000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy S21 5G", "storage": "256GB", "ram": "8GB", "price_kes": 30000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy S21 ULTRA", "storage": "128GB", "ram": "8GB", "price_kes": 40000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy S22", "storage": "256GB", "ram": "8GB", "price_kes": 34000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy S22 ULTRA", "storage": "256GB", "ram": "12GB", "price_kes": 53000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy S23 5G", "storage": "256GB", "ram": "8GB", "price_kes": 47000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy S23 5G", "storage": "512GB", "ram": "8GB", "price_kes": 51000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy S23 PLUS 5G", "storage": "256GB", "ram": "8GB", "price_kes": 47000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy S23 ULTRA", "storage": "256GB", "ram": "12GB", "price_kes": 67000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy S24 5G", "storage": "256GB", "ram": "8GB", "price_kes": 63000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy S24 PLUS", "storage": "256GB", "ram": "8GB", "price_kes": 60000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy S24 ULTRA", "storage": "256GB", "ram": "12GB", "price_kes": 89000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy S24 ULTRA", "storage": "512GB", "ram": "12GB", "price_kes": 94000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy S25 5G", "storage": "256GB", "ram": "12GB", "price_kes": 80000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy S25 ULTRA", "storage": "256GB", "ram": "12GB", "price_kes": 110000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy Z FOLD 4", "storage": "256GB", "ram": "12GB", "price_kes": 65000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy Z FOLD 5", "storage": "512GB", "ram": "12GB", "price_kes": 80000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy Z FOLD 6", "storage": "256GB", "ram": "12GB", "price_kes": 105000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy Z FLIP 6", "storage": "512GB", "ram": "12GB", "price_kes": 60000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Samsung", "model": "Galaxy NOTE 20 ULTRA", "storage": "256GB", "ram": "8GB", "price_kes": 43000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Apple", "model": "iPhone XR", "storage": "128GB", "ram": null, "price_kes": 25000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Apple", "model": "iPhone 11", "storage": "128GB", "ram": null, "price_kes": 31000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Apple", "model": "iPhone 11 Pro", "storage": "256GB", "ram": null, "price_kes": 38000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Apple", "model": "iPhone 12", "storage": "128GB", "ram": null, "price_kes": 35000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Apple", "model": "iPhone 12 Pro", "storage": "128GB", "ram": null, "price_kes": 40000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Apple", "model": "iPhone 12 Pro", "storage": "256GB", "ram": null, "price_kes": 44000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Apple", "model": "iPhone 13", "storage": "128GB", "ram": null, "price_kes": 43000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Apple", "model": "iPhone 13 Pro", "storage": "128GB", "ram": null, "price_kes": 55000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Apple", "model": "iPhone 13 Pro", "storage": "256GB", "ram": null, "price_kes": 62000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Apple", "model": "iPhone 13 Pro Max", "storage": "256GB", "ram": null, "price_kes": 71000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Apple", "model": "iPhone 14 Pro", "storage": "256GB", "ram": null, "price_kes": 73000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Apple", "model": "iPhone 14 Pro", "storage": "512GB", "ram": null, "price_kes": 77000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Apple", "model": "iPhone 14 Pro Max", "storage": "256GB", "ram": null, "price_kes": 85000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Apple", "model": "iPhone 15 Pro", "storage": "256GB", "ram": null, "price_kes": 100000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Apple", "model": "iPhone 15 Pro Max", "storage": "256GB", "ram": null, "price_kes": 113000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Apple", "model": "iPhone 16 Pro", "storage": "256GB", "ram": null, "price_kes": 150000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Apple", "model": "iPhone 17 Air", "storage": "256GB", "ram": null, "price_kes": 140000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Apple", "model": "iPhone 17 Pro", "storage": "256GB", "ram": null, "price_kes": 190000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Apple", "model": "iPhone 17 Pro Max", "storage": "256GB", "ram": null, "price_kes": 210000, "sim_type": "Standard", "source_platform": "Instagram" },
  { "brand": "Apple", "model": "iPhone 17 Pro", "storage": "256GB", "ram": null, "price_kes": 170000, "sim_type": "eSIM", "source_platform": "Instagram" },
  { "brand": "Apple", "model": "iPhone 17 Pro Max", "storage": "256GB", "ram": null, "price_kes": 185000, "sim_type": "eSIM", "source_platform": "Instagram" }
];

export const runSeeder = async () => {
  try {
    console.log('--- STARTING CENTSTORE DATABASE SEEDING OPERATION ---');

    // 1. Establish MongoDB Connection
    console.log('[MongoDB] Connecting to cluster...');
    const conn = await connectDB();
    console.log(`[MongoDB] Connection successful: host=${conn.connection.host}, database=${conn.connection.name}`);

    // 2. Establish and Verify Cloudinary Connection
    console.log('[Cloudinary] Configuring connection parameters...');
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    
    console.log(`[Cloudinary] Configuration active for cloud name: ${process.env.CLOUDINARY_CLOUD_NAME}`);
    
    try {
      const pingResult = await cloudinary.api.ping();
      console.log(`[Cloudinary] Connection verified successfully. Ping Result:`, pingResult);
    } catch (pingErr) {
      console.error(`[Cloudinary] WARNING: Verification ping failed. Credentials may be incorrect:`, pingErr.message);
    }

    // 3. Extract Unique Models & Download Images
    console.log('[Seeder] Extracting unique brand + model combinations...');
    const uniqueModelsMap = {};
    rawProductsList.forEach(p => {
      const key = `${p.brand} ${p.model}`;
      if (!uniqueModelsMap[key]) {
        uniqueModelsMap[key] = {
          brand: p.brand,
          model: p.model
        };
      }
    });

    const uniqueModels = Object.values(uniqueModelsMap);
    console.log(`[Seeder] Found ${uniqueModels.length} unique phone models.`);

    console.log('[Image Downloader] Verifying and downloading product images...');
    const cloudinaryUrls = {};

    for (let i = 0; i < uniqueModels.length; i++) {
      const { brand, model } = uniqueModels[i];
      const modelKey = `${brand} ${model}`;
      const safeFilename = modelKey.toLowerCase().replace(/[^a-z0-9]/g, '_') + '.jpg';
      const localPath = path.join(uploadsDir, safeFilename);

      console.log(`[${i+1}/${uniqueModels.length}] Processing: "${modelKey}"`);
      
      let imageDownloaded = false;

      // Check cache first
      if (fs.existsSync(localPath)) {
        console.log(`  -> Found locally cached file: ${safeFilename}`);
        imageDownloaded = true;
      } else {
        // Try searching Bing Images
        const searchQuery = `${brand} ${model} phone white background`;
        console.log(`  -> Searching Bing for image: "${searchQuery}"...`);
        const searchUrl = await searchBingImage(searchQuery);
        
        if (searchUrl) {
          console.log(`  -> Found search URL: ${searchUrl}. Downloading...`);
          try {
            await downloadImage(searchUrl, localPath);
            console.log(`  -> Download successful!`);
            imageDownloaded = true;
          } catch (dlErr) {
            console.log(`  -> Download failed: ${dlErr.message}`);
          }
        }
      }

      // Fallback if not downloaded
      if (!imageDownloaded) {
        const fallbackUrl = getFallbackImage(modelKey);
        console.log(`  -> Falling back to free stock image: ${fallbackUrl}`);
        try {
          await downloadImage(fallbackUrl, localPath);
          console.log(`  -> Fallback download successful!`);
          imageDownloaded = true;
        } catch (fbErr) {
          console.error(`  -> Critical: Fallback download failed: ${fbErr.message}`);
        }
      }

      // Upload to Cloudinary if downloaded successfully
      if (imageDownloaded) {
        try {
          const publicId = `centstore/products/${modelKey.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
          console.log(`  -> Uploading to Cloudinary with publicId: ${publicId}...`);
          const uploadRes = await cloudinary.uploader.upload(localPath, {
            public_id: publicId,
            overwrite: true,
            resource_type: 'image'
          });
          cloudinaryUrls[modelKey] = uploadRes.secure_url;
          console.log(`  -> Cloudinary upload successful: ${uploadRes.secure_url}`);
        } catch (uploadErr) {
          console.error(`  -> Cloudinary upload failed: ${uploadErr.message}`);
          // Fallback to local upload route url if Cloudinary upload fails
          const safeWebPath = `/uploads/products/${safeFilename}`;
          cloudinaryUrls[modelKey] = safeWebPath;
        }
      } else {
        // Ultimate fallback
        cloudinaryUrls[modelKey] = '/products/iphone17.jpg';
      }
    }

    // 4. Map products array
    console.log('[MongoDB] Formatting product array matching Schema requirements...');
    const mappedProducts = rawProductsList.map((p, idx) => {
      const modelKey = `${p.brand} ${p.model}`;
      const imageUrl = cloudinaryUrls[modelKey] || '/products/iphone17.jpg';

      let category = 'OnePlus & Redmi';
      const brandLower = p.brand.toLowerCase();
      if (brandLower === 'apple') {
        category = 'Apple iPhones';
      } else if (brandLower === 'samsung') {
        category = 'Samsung Galaxy';
      }

      // Generate title
      let title = `${p.brand} ${p.model}`;
      if (p.sim_type && p.sim_type !== 'Standard') {
        title += ` (${p.sim_type})`;
      }

      const price = Number(p.price_kes);
      const markupPercentage = 5 + (idx % 11);
      const originalPrice = Math.round(price * (1 + markupPercentage / 100) / 100) * 100;
      const discountPercentage = Math.round(((originalPrice - price) / originalPrice) * 100);

      let storageStr = p.storage;
      if (p.ram) {
        storageStr = `${p.ram}/${p.storage}`;
      }

      const desc = `Premium ${p.brand} ${p.model} with ${p.storage} storage. ` +
        (p.ram ? `Features a superfast ${p.ram} RAM configuration. ` : '') +
        `Supports standard network configurations with ${p.sim_type || 'Standard'} SIM options. ` +
        `Directly imported and certified by Cent Store Kenya for reliability and premium quality.`;

      return {
        id: idx + 1,
        title: title,
        name: title,
        price: price,
        originalPrice: originalPrice,
        discountPercentage: discountPercentage,
        rating: 4.5 + ((idx * 7) % 6) / 10,
        imageUrl: imageUrl,
        images: [imageUrl],
        brand: p.brand,
        category: category,
        storage: storageStr,
        note: p.sim_type && p.sim_type !== 'Standard' ? `${p.sim_type} Edition` : 'Available',
        isFlashSale: idx < 6, // first 6 products flash sale
        status: 'active',
        description: desc,
        stock: 10 + (idx % 8),
        sold: idx % 4
      };
    });

    // 5. Database Seeding
    console.log('[MongoDB] Clearing existing products collection...');
    await Product.deleteMany();
    console.log('[MongoDB] Existing products cleared.');

    console.log(`[MongoDB] Inserting ${mappedProducts.length} new products...`);
    const inserted = await Product.insertMany(mappedProducts);
    console.log(`[MongoDB] Seeding completed successfully. Inserted count: ${inserted.length}`);

    // Save mapping to products.json so local startup seeder has it
    const dbPath = path.join(__dirname, 'products.json');
    fs.writeFileSync(dbPath, JSON.stringify(mappedProducts, null, 2), 'utf8');
    console.log(`[Seeder] Saved products schema list to ${dbPath}`);

    console.log('--- CENTSTORE DATABASE SEEDING COMPLETED SUCCESSFULLY ---');
  } catch (err) {
    console.error(`[Seeder Error] Process failed with error:`, err);
    throw err;
  }
};

// Check if run directly from command line
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSeeder()
    .then(() => {
      console.log('Seeder run complete. Exiting.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seeder run failed:', err);
      process.exit(1);
    });
}
