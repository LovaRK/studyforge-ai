# Security

StudyForge AI is a single-owner app that holds private study material. Please report vulnerabilities privately through GitHub's **Report a vulnerability** button on the Security tab, not in a public issue.

## Design

- Every page and API route requires the owner session. `src/proxy.ts` sends signed-out requests to `/login` (APIs get `401`), and each page, Server Action and route handler checks the session again.
- The owner password is stored only as a salted scrypt hash. Sessions are httpOnly, SameSite cookies signed with HMAC-SHA256.
- Failed logins are rate-limited per client.
- Secrets come from environment variables only. The logger redacts keys that look sensitive, and the Gemini key is sent in a header, never in a URL.
- All input crossing a boundary (forms, env, model output) is validated with zod.
- Responses carry `noindex`, `X-Frame-Options: DENY`, `nosniff` and a same-origin referrer policy.
