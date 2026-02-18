/**
 * Link-check API for PHHE Link Validator (Vercel serverless).
 * GET /api/check-link?url=https://example.com
 * Returns { statusCode, ok } or { statusCode: 502, ok: false, error }.
 *
 * Certificate handling: if the first request fails with a TLS/certificate error
 * (e.g. "unable to get local issuer certificate" on OpenWHO in Vercel's runtime),
 * we retry once with a permissive TLS agent and return the server's real HTTP
 * status. This avoids false positives where valid links are marked broken.
 */

const https = require('https');
const url = require('url');

const CERT_ERROR_PATTERNS = [
  'unable to get local issuer certificate',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'self signed certificate',
  'SELF_SIGNED_CERTIFICATE',
  'certificate',
  'CERT_',
  'EPERM.*certificate',
  'unable to verify the first certificate',
];

function isCertificateError(err) {
  if (!err || !err.message) return false;
  const msg = (err.message || '').toLowerCase();
  const code = (err.code || '').toUpperCase();
  return CERT_ERROR_PATTERNS.some(
    (p) => msg.includes(p.toLowerCase()) || code.includes(p.toUpperCase().replace(/\s/g, '_'))
  );
}

function fetchStatus(targetUrl, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(targetUrl);
    if (!parsed.protocol || !parsed.host) {
      reject(new Error('Invalid URL'));
      return;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      reject(new Error('Only HTTP(S) URLs are supported'));
      return;
    }

    const lib = parsed.protocol === 'https:' ? https : require('http');
    const reqOpts = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.path || '/',
      method: 'HEAD',
      timeout: 12000,
      headers: {
        'User-Agent': 'PHHE-LinkValidator/1.0 (link-check)',
      },
      ...options,
    };

    const req = lib.request(reqOpts, (res) => {
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    req.end();
  });
}

async function checkLink(targetUrl) {
  try {
    const statusCode = await fetchStatus(targetUrl);
    return { statusCode, ok: statusCode >= 200 && statusCode < 400 };
  } catch (firstErr) {
    if (isCertificateError(firstErr)) {
      const agent = new https.Agent({ rejectUnauthorized: false });
      try {
        const statusCode = await fetchStatus(targetUrl, { agent });
        return { statusCode, ok: statusCode >= 200 && statusCode < 400 };
      } catch (retryErr) {
        return {
          statusCode: 502,
          ok: false,
          error: retryErr.message || 'Request failed after certificate-relaxed retry',
        };
      }
    }
    return {
      statusCode: 502,
      ok: false,
      error: firstErr.message || 'Request failed',
    };
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ statusCode: 405, ok: false, error: 'Method not allowed' });
    return;
  }

  let targetUrl = (req.query && req.query.url);
  if (targetUrl == null && req.url) {
    try {
      const u = new URL(req.url, 'https://vercel.link');
      targetUrl = u.searchParams.get('url');
    } catch (_) {}
  }
  if (!targetUrl || typeof targetUrl !== 'string') {
    res.status(400).json({ statusCode: 400, ok: false, error: 'Missing or invalid url query' });
    return;
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    res.status(400).json({ statusCode: 400, ok: false, error: 'Invalid URL' });
    return;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    res.status(400).json({ statusCode: 400, ok: false, error: 'Only HTTP(S) URLs are allowed' });
    return;
  }

  const result = await checkLink(targetUrl);
  const status = result.statusCode >= 200 && result.statusCode < 300 ? result.statusCode : 200;
  res.status(status).json(result);
};
