import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import scanRouter from './routes/scan.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  process.loadEnvFile(path.resolve(__dirname, '../../.env'));
} catch {
  // No root .env present; rely on the process environment instead.
}

const PORT = process.env.PORT || 4000;

// FRONTEND_ORIGIN may be a single origin or a comma-separated list (e.g. for
// running the Vite dev server locally alongside a tunneled/deployed origin).
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
];
const allowedOrigins = (process.env.FRONTEND_ORIGIN
  ? process.env.FRONTEND_ORIGIN.split(',')
  : DEFAULT_ALLOWED_ORIGINS
)
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Requests with no Origin header (curl, server-to-server, same-origin) are not
    // subject to CORS, so let them through.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn(`CORS: rejected Origin "${origin}" — allowed origins: ${allowedOrigins.join(', ')}`);
    return callback(new Error(`Origin "${origin}" is not allowed by CORS`));
  },
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/scan', scanRouter);

// Keep this after the routes so CORS headers already set by the cors middleware
// above are preserved on error responses (e.g. thrown/rejected route handlers)
// instead of the request failing silently as a browser-side CORS error.
app.use((err, req, res, _next) => {
  if (err.message?.startsWith('Origin "')) {
    return res.status(403).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`SecureScanAI backend listening on http://localhost:${PORT}`);
  console.log(`CORS allowed origins: ${allowedOrigins.join(', ')}`);
});
