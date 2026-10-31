# reID Connect

Implemented in `server/reid.js` with `fpreid-connect-sdk` 0.4.0 (UAT).

## What it does
- **Browsing is open to everyone.** reID is only needed to buy.
- **Sign in** (header button or when buying):
  - Phone: redirect flow → reID app → back to `https://remarketplace.store/auth/reid/callback`.
  - Computer: QR code (device authorization) scanned with the reID app; the page polls until approved. "Open reID on this device instead" falls back to the redirect flow.
- **Buy with reID** (per product, off by default): Admin → product → *Buy with reID (payments)*. Set price, currency symbol, receiving wallet, optional ERC-20 token contract + decimals, chain (INFRA UAT 15324). The product page then shows **Buy with reID · price**. Not signed in → sign-in first, then the payment starts automatically. The user approves in the reID app (QR on desktop, app link on phones); the page polls until `broadcast`, `denied`, `failed` or expired (15 min).
- **Orders** are stored in `rm_orders` and listed in Admin → Bookings → *reID purchases*. `broadcast` means the node accepted the tx — confirm on-chain before delivering.

## Routes
| Route | |
|---|---|
| `GET /auth/reid/start?ret=/path` | Redirect sign-in (PKCE + state). Always starts on `APP_PUBLIC_URL`'s host so the session cookie survives. |
| `GET /auth/reid/callback` | Registered redirect URI. Checks state (timing-safe, 10-min limit), exchanges the code. |
| `POST /auth/reid/device/start`, `POST /auth/reid/device/poll` | Desktop QR sign-in. |
| `GET /api/me`, `POST /api/auth/logout` | Session. `/api/me` returns only public profile fields. |
| `POST /api/buy/:slug`, `GET /api/buy/status/:intentId` | Payment request and status. |

## Security
- Scopes requested: `profile wallet:read wallet:tx kyc:read` (all registered). Granted scopes are checked; buying requires `wallet:tx`.
- Access/refresh tokens, PKCE verifier and device code are AES-256-GCM encrypted inside the signed session cookie (key derived from `SESSION_SECRET`). Never sent to the browser in readable form, never logged.
- Tokens refresh automatically 5 minutes before expiry; a failed refresh signs the user out.
- Payment summary text is built on the server from the product record, never from browser input.
- ERC-20 payments are encoded server-side as `transfer(payTo, amount)` with BigInt maths (no float rounding).

## Env
`REID_CLIENT_ID`, `REID_CLIENT_SECRET`, `REID_REDIRECT_URI=https://remarketplace.store/auth/reid/callback`, `REID_BASE_URL=https://uat-wallet.reidentity.net`, `REID_APP_URL=https://app.reidentity.net`, `APP_PUBLIC_URL=https://remarketplace.store`.
For production, replace with production values from reID (never reuse UAT).
