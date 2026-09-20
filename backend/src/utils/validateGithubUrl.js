const GITHUB_URL_PATTERN = /^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/;

/**
 * Validates that a string is a well-formed public GitHub repository URL
 * (https://github.com/<owner>/<repo>) and returns its normalized clone URL.
 * Returns { valid: false } for anything else, including non-GitHub hosts,
 * SSH URLs, and URLs carrying credentials/query strings/fragments.
 */
export function validateGithubUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
    return { valid: false, reason: 'Repository URL is required.' };
  }

  const trimmed = rawUrl.trim();

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, reason: 'Not a valid URL.' };
  }

  if (parsed.protocol !== 'https:') {
    return { valid: false, reason: 'Only https:// GitHub URLs are supported.' };
  }

  if (parsed.hostname.toLowerCase() !== 'github.com') {
    return { valid: false, reason: 'Only github.com repository URLs are supported.' };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, reason: 'URLs with embedded credentials are not allowed.' };
  }

  const match = trimmed.match(GITHUB_URL_PATTERN);
  if (!match) {
    return { valid: false, reason: 'URL must look like https://github.com/owner/repository.' };
  }

  const [, owner, repo] = match;
  const cloneUrl = `https://github.com/${owner}/${repo}.git`;

  return { valid: true, owner, repo, cloneUrl };
}
