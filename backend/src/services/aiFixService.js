const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
const REQUEST_TIMEOUT_MS = 60_000;

// `context` is built by contextBuilder.js from the cloned repo before the
// workspace is deleted, so no filesystem access happens here.
export async function generateFix(context) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured on the server.');
  }

  const prompt = buildPrompt(context);

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
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
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

  const parsed = parseJsonResponse(content);
  const fix = validateFixResponse(parsed, context.finding.file);

  return { model: data.model ?? DEFAULT_MODEL, ...fix };
}

const SYSTEM_PROMPT =
  'You are a security engineer fixing a single Semgrep finding. You are given the finding, the complete ' +
  'affected source file (the "primary file"), and read-only local dependency files for context. ' +
  'Rules: ' +
  '(1) You may only modify the primary file; dependency files are read-only context and must not be changed. ' +
  '(2) Make the smallest reasonable change that fixes the security issue. ' +
  '(3) Preserve existing behavior, public function/method signatures, and overall structure wherever possible. ' +
  '(4) Do not perform unrelated refactoring, do not change or add dependencies unless strictly necessary for the ' +
  'fix, and do not remove functionality merely to silence the scanner. ' +
  '(5) Respond with ONLY a single valid JSON object — no markdown, no code fences, no commentary before or after ' +
  'it — matching exactly this schema: ' +
  '{"explanation": string, "file_path": string, "fixed_code": string, "changes": string[]}. ' +
  '"file_path" must exactly equal the primary file path given below. "fixed_code" must be the COMPLETE corrected ' +
  'contents of the primary file (not a snippet or diff). "changes" is a short list of the important changes made.';

function buildPrompt(context) {
  const { finding, primary_file: primaryFile, dependencies } = context;

  const lines = [
    `Vulnerability rule: ${finding.rule_id}`,
    `Severity: ${finding.severity ?? 'unknown'}`,
    `Message: ${finding.message ?? 'No message provided.'}`,
    `Primary file path (this is the required "file_path" value, and the only file you may modify): ${finding.file}`,
    `Flagged lines: ${finding.start_line ?? '?'}-${finding.end_line ?? '?'}`,
  ];

  if (primaryFile?.content) {
    lines.push(
      '',
      `--- BEGIN PRIMARY FILE: ${primaryFile.path} ---`,
      primaryFile.content,
      `--- END PRIMARY FILE: ${primaryFile.path} ---`
    );
  } else {
    lines.push('', 'Primary file contents were not available; answer generally for this rule.');
  }

  if (dependencies?.length) {
    lines.push(
      '',
      'The following local files are provided as READ-ONLY context (imported by the primary file). ' +
        'Do not propose changes to them; they exist only to help you understand how the primary file is used.'
    );
    for (const dep of dependencies) {
      lines.push('', `--- BEGIN DEPENDENCY (read-only): ${dep.path} ---`, dep.content, `--- END DEPENDENCY: ${dep.path} ---`);
    }
  }

  lines.push(
    '',
    'Return ONLY the JSON object described in your instructions. "file_path" must be exactly ' +
      `"${finding.file}" and "fixed_code" must be the complete fixed file.`
  );
  return lines.join('\n');
}

// Model output is untrusted text, not guaranteed to be clean JSON even when
// asked for it — some models still wrap it in ```json fences. Try a straight
// parse first, then a conservative fence-stripping fallback, before giving up.
function parseJsonResponse(content) {
  try {
    return JSON.parse(content);
  } catch {
    // fall through to fallback
  }

  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : content.slice(content.indexOf('{'), content.lastIndexOf('}') + 1);

  try {
    return JSON.parse(candidate);
  } catch (err) {
    throw new Error(`AI response was not valid JSON: ${err.message}`);
  }
}

function validateFixResponse(parsed, expectedFilePath) {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('AI response was not a JSON object.');
  }

  const { explanation, file_path: filePath, fixed_code: fixedCode, changes } = parsed;

  if (typeof explanation !== 'string' || explanation.trim() === '') {
    throw new Error('AI response is missing a valid "explanation" string.');
  }
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    throw new Error('AI response is missing a valid "file_path" string.');
  }
  if (typeof fixedCode !== 'string' || fixedCode.trim() === '') {
    throw new Error('AI response is missing valid non-empty "fixed_code".');
  }
  if (!Array.isArray(changes) || !changes.every((c) => typeof c === 'string')) {
    throw new Error('AI response is missing a valid "changes" string array.');
  }
  if (filePath !== expectedFilePath) {
    // Security constraint: the model may only propose a fix for the
    // primary/affected file, never a dependency or arbitrary path.
    throw new Error(
      `AI response targeted an unexpected file ("${filePath}"); expected the primary file ("${expectedFilePath}").`
    );
  }

  return { explanation, file_path: filePath, fixed_code: fixedCode, changes };
}
