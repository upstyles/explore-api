import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { initializeFirebase } from './lib/firebase.js';
import { rateLimitAPI } from './middleware/rate-limit.js';
import routes from './routes/index.js';

// Load environment variables
dotenv.config();

// Initialize Firebase
initializeFirebase();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(helmet());

// Configure CORS
const allowedOrigins = [
  'https://upstyles-pro.web.app',
  'https://upstyles-pro.firebaseapp.com',
  'http://localhost:5000',
  'http://localhost:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins for now
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length', 'X-Request-Id', 'Retry-After'],
  maxAge: 86400 // 24 hours
}));

app.use(express.json({ limit: '10mb' }));
app.use(rateLimitAPI);

// Routes
app.use('/api', routes);

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`[Server] Explore API running on port ${PORT}`);
  console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
