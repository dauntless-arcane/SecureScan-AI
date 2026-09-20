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
const ALLOWED_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173' || 'http://localhost:5174';

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/scan', scanRouter);

app.listen(PORT, () => {
  console.log(`SecureScanAI backend listening on http://localhost:${PORT}`);
});
