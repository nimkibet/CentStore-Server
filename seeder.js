import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from './src/config/db.js';
import Product from './src/models/Product.js';

// Resolve directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'products.json');

// Load environment variables
dotenv.config();

const importData = async () => {
  try {
    await connectDB();

    console.log('Reading products.json data...');
    const rawData = fs.readFileSync(dbPath, 'utf8');
    const initialProducts = JSON.parse(rawData);

    const mappedProducts = initialProducts.map(p => ({
      id: p.id,
      title: p.title,
      name: p.title, // syncs title and name
      price: Number(p.price) || 0,
      originalPrice: Number(p.originalPrice) || Number(p.price) || 0,
      discountPercentage: Number(p.discountPercentage) || 0,
      rating: Number(p.rating) || 5.0,
      imageUrl: p.imageUrl || '/products/iphone17.jpg',
      brand: p.brand || 'Generic',
      category: p.category || 'Premium Accessories',
      storage: p.storage || 'Standard',
      note: p.note || 'Available',
      isFlashSale: p.isFlashSale || false,
      status: 'active',
      description: p.description || ''
    }));

    // Clear existing collection to avoid duplicates
    console.log('Clearing existing products...');
    await Product.deleteMany();

    // Insert mapped products
    console.log('Inserting new products...');
    await Product.insertMany(mappedProducts);

    console.log('Data Imported Successfully!');
    process.exit();
  } catch (error) {
    console.error(`Error with data import: ${error.message}`);
    process.exit(1);
  }
};

const destroyData = async () => {
  try {
    await connectDB();

    console.log('Clearing all products from database...');
    await Product.deleteMany();

    console.log('Data Destroyed Successfully!');
    process.exit();
  } catch (error) {
    console.error(`Error with data destruction: ${error.message}`);
    process.exit(1);
  }
};

// Check CLI arguments to run import or destroy
if (process.argv[2] === '-d') {
  destroyData();
} else {
  importData();
}
