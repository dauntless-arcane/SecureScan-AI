import { readFile } from 'node:fs/promises';
import path from 'node:path';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
const REQUEST_TIMEOUT_MS = 60_000;
const SNIPPET_CONTEXT_LINES = 8;

export async function generateFix(scan, finding) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured on the server.');
  }

  const snippet = await readSnippet(scan.workspacePath, finding);
  const prompt = buildPrompt(finding, snippet);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'You are a security engineer. Given a vulnerability finding and its surrounding source code, ' +
              'explain the fix concisely and then provide the corrected code. Respond in markdown: a short ' +
              'explanation followed by a single fenced code block containing only the fixed snippet.',
          },
          { role: 'user', content: prompt },
        ],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`AI fix request timed out after ${REQUEST_TIMEOUT_MS / 1000}s.`);
    }
    throw new Error(`Failed to reach OpenRouter: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`OpenRouter request failed (${response.status}): ${body.slice(0, 500)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenRouter returned an empty response.');
  }

  return { model: data.model ?? DEFAULT_MODEL, content };
}

async function readSnippet(workspacePath, finding) {
  const filePath = path.join(workspacePath, finding.file);

  let source;
  try {
    source = await readFile(filePath, 'utf8');
  } catch {
    return null;
  }

  const lines = source.split('\n');
  const startLine = finding.start_line ?? 1;
  const endLine = finding.end_line ?? startLine;
  const from = Math.max(1, startLine - SNIPPET_CONTEXT_LINES);
  const to = Math.min(lines.length, endLine + SNIPPET_CONTEXT_LINES);

  return lines
    .slice(from - 1, to)
    .map((line, i) => `${from + i}: ${line}`)
    .join('\n');
}

function buildPrompt(finding, snippet) {
  const lines = [
    `Vulnerability rule: ${finding.rule_id}`,
    `Severity: ${finding.severity ?? 'unknown'}`,
    `Message: ${finding.message ?? 'No message provided.'}`,
    `File: ${finding.file} (lines ${finding.start_line ?? '?'}-${finding.end_line ?? '?'})`,
  ];

  if (snippet) {
    lines.push('', 'Source code (line numbers included):', '```', snippet, '```');
  } else {
    lines.push('', 'Source code snippet was not available; answer generally for this rule.');
  }

  lines.push('', 'Provide the fix.');
  return lines.join('\n');
}
