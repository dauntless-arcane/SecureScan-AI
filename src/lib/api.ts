export type ScanStatus = 'QUEUED' | 'CLONING' | 'CLONED' | 'SCANNING' | 'COMPLETED' | 'FAILED';

export interface ScanState {
  scan_id: string;
  status: ScanStatus;
  error?: string;
  scanner?: string;
  finding_count?: number;
}

export interface Finding {
  rule_id: string;
  message: string | null;
  severity: string | null;
  file: string;
  start_line: number | null;
  end_line: number | null;
}

export interface ScanReport {
  scan_id: string;
  repo_url: string;
  status: ScanStatus;
  scanner: string;
  semgrep_version: string | null;
  semgrep_command: string | null;
  finding_count: number;
  findings: Finding[];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

async function parseJsonOrThrow(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.error ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return body;
}

export async function submitScan(repoUrl: string): Promise<ScanState> {
  const response = await fetch(`${API_BASE_URL}/scan/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_url: repoUrl }),
  });
  return parseJsonOrThrow(response);
}

export async function getScanStatus(scanId: string): Promise<ScanState> {
  const response = await fetch(`${API_BASE_URL}/scan/status/${encodeURIComponent(scanId)}`);
  return parseJsonOrThrow(response);
}

export async function getScanReport(scanId: string): Promise<ScanReport> {
  const response = await fetch(`${API_BASE_URL}/scan/report/${encodeURIComponent(scanId)}`);
  return parseJsonOrThrow(response);
}

export interface FixResult {
  model: string;
  content: string;
}

export async function generateFindingFix(scanId: string, findingIndex: number): Promise<FixResult> {
  const response = await fetch(`${API_BASE_URL}/scan/fix/${encodeURIComponent(scanId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ finding_index: findingIndex }),
  });
  return parseJsonOrThrow(response);
}
