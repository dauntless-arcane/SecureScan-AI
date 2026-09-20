import { Router } from 'express';
import { createScan, getScan, getScanReport, requestFindingFix } from '../services/scanService.js';

const router = Router();

router.post('/submit', (req, res) => {
  const { repo_url } = req.body ?? {};

  const result = createScan(repo_url);
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  return res.status(202).json(result.scan);
});

router.get('/status/:scan_id', (req, res) => {
  const scan = getScan(req.params.scan_id);
  if (!scan) {
    return res.status(404).json({ error: 'Scan not found.' });
  }
  return res.status(200).json(scan);
});

router.get('/report/:scan_id', (req, res) => {
  const report = getScanReport(req.params.scan_id);
  if (!report) {
    return res.status(404).json({ error: 'Scan not found.' });
  }
  return res.status(200).json(report);
});

router.post('/fix/:scan_id', async (req, res) => {
  const { finding_index } = req.body ?? {};
  if (typeof finding_index !== 'number' || !Number.isInteger(finding_index) || finding_index < 0) {
    return res.status(400).json({ error: 'finding_index (non-negative integer) is required.' });
  }

  const result = await requestFindingFix(req.params.scan_id, finding_index);
  if (result.error === 'not_found') {
    return res.status(404).json({ error: result.message });
  }
  if (result.error) {
    return res.status(502).json({ error: result.message });
  }
  return res.status(200).json(result.fix);
});

export default router;
