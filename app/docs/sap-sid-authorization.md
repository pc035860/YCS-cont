# SAPISID-Based Authorization Header Implementation

## What is SAPISID Authorization?

YouTube's internal API requires special authorization headers to verify user identity. These headers are generated based on `SAPISID` and `APISID` cookies in the browser, allowing the extension to access YouTube data that requires authentication.

## Why Do We Need This Feature?

- **Members-only content**: Access to members-only chat messages and badges
- **Personalized data**: Retrieve user-specific recommendations and settings
- **Full functionality**: Ensure the extension can access all available YouTube data

## How It Works

### 1. Origin Normalization
The system first extracts origin information from the current page URL:
- Only accepts secure protocols (HTTPS, extension protocols, etc.)
- Automatically strips default ports
- Normalizes to origin format

### 2. Secret Resolution
The system searches for authorization secrets in this order:
- `window.__SAPISID` / `window.__APISID` (priority)
- `SAPISID`, `APISID` cookies
- `__Secure-1PAPISID`, `__Secure-3PAPISID` (secure cookies)
- `__1PSAPISID`, `__3PSAPISID` (first-party/third-party variants)

### 3. Header Generation
Each secret is combined with the origin information and hashed using SHA-1 algorithm to generate authorization headers:
- `SAPISIDHASH` / `APISIDHASH` (main headers)
- `SAPISID1PHASH` (first-party cookie, HTTPS only)
- `SAPISID3PHASH` (third-party cookie, HTTPS only)

## Usage Examples

### Basic Usage

```typescript
import { buildSapSidAuthorizationHeader } from '../utils/innertube';

// Generate authorization header
const authHeader = buildSapSidAuthorizationHeader();

if (authHeader) {
    // Use in API requests
    fetch(url, { 
        headers: { Authorization: authHeader }, 
        credentials: 'include' 
    });
}
```

### Advanced Usage (with extras)

```typescript
// Generate header for specific scenarios (e.g., when _u suffix is needed)
const authHeader = buildSapSidAuthorizationHeader({
    extras: [{ key: 'u', value: userSessionId }]
});
```

## Technical Details

### File Locations
- **Implementation**: `app/src/source/utils/innertube/authHeaders.ts`
- **Export point**: `app/src/source/utils/innertube.ts`

### Dependencies
- `crypto-js` v4.2.0: SHA-1 hashing algorithm
- `@types/crypto-js` v4.2.2: TypeScript type definitions

### Security Considerations
- Only operates under secure protocols
- Automatically handles different cookie types
- Supports extension security contexts

## Implementation Notes

- **Origin Normalization**: The current page URL (or an explicit override) is reduced to an origin string. Only whitelisted schemes are accepted (HTTPS, Chrome/Firefox extension protocols, etc.), and default ports are stripped.

- **Secret Resolution**: Depending on the protocol, the utility looks for secrets in this order:
  - `window.__SAPISID` / `window.__APISID`
  - document cookies (`SAPISID`, `APISID`, `__Secure-1PAPISID`, `__Secure-3PAPISID`)
  - Optional `__1PSAPISID` / `__3PSAPISID` for first-party and third-party variants

- **Hash Input Assembly**: Each secret is paired with the normalized origin. Optional metadata (`extras`) is supported; when present, the payload also includes a Unix timestamp and the provided values, matching the format that appends suffixes such as `_u`.

- **Digest**: The payload string is hashed with SHA-1. The project now delegates hashing to the `crypto-js` library (`SHA1`), ensuring consistent output across environments.

- **Header Formatting**: The digest is prefixed with the corresponding header name:
  - `SAPISIDHASH` / `APISIDHASH` (main token)
  - `SAPISID1PHASH` (1P cookie, HTTPS contexts only)
  - `SAPISID3PHASH` (3P cookie, HTTPS contexts only)
  Each token is joined with spaces to form the final `Authorization` header.

## Frequently Asked Questions

**Q: Why do we need such a complex authorization mechanism?**
A: YouTube uses multi-layered security mechanisms to protect user data. This implementation ensures the extension can securely access APIs that require authentication.

**Q: What happens if there's no SAPISID cookie?**
A: The function returns `null`, and the extension falls back to API calls that don't require authorization.

**Q: Is this implementation compatible with YouTube's official implementation?**
A: Yes, this implementation follows the same algorithm used by YouTube's Polymer bundle, ensuring compatibility.

## Related Documentation

- [Innertube Comments Integration](innertube-comments-integration.md) - Comment integration guide
- [API Migration Guide](innertube-migration-guide.md) - API migration guide
- [Chat Replay API Changes](innertube-chat-replay-api-changes.md) - Chat replay API changes
