# 🧊 CryoPay Worker

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-0ea5e9?style=flat&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Hono](https://img.shields.io/badge/Hono-v4.4.5-ff3e6b?style=flat&logo=hono&logoColor=white)](https://hono.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-ES2022-blue?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-Vitest-brightgreen)](https://vitest.dev/)
[![D1 Database](https://img.shields.io/badge/Database-D1%20(SQLite)-007acc?style=flat&logo=sqlite&logoColor=white)](https://developers.cloudflare.com/d1/)

**Production-ready Cloudflare Worker backend for CryoPay** – Secure user authentication, Ethereum wallet integration, blockchain transaction recording with CryoPayTransactionRecorder smart contract.

## ✨ Features

- 🔐 **Full Authentication**: Email/password (PBKDF2/WebCrypto), OTP/magic links, MFA (TOTP + backup codes)
- 🪙 **MetaMask Integration**: Wallet connect/link (EIP-191 signatures, nonces), challenge-response verification
- 💳 **Wallet Management**: Store/retrieve JWK public keys, encrypted private keys, verification
- ⛓️ **Blockchain Transactions**: Record P2P tx, status polling (receipts), contract event sync
- 📊 **Ethereum RPC**: Balances, gas prices, network info, contract ABI/address
- 🛡️ **Security**: JWT (HS256), Zod validation, signature verification, rate limiting ready
- 🗄️ **D1 Database**: Users, wallets, ethereum_users, blockchain_transactions, contract_events
- 🧪 **Comprehensive Tests**: Unit (routes/auth/schemas), integration workflows (Vitest)
- 🚀 **Production Deploy**: Wrangler, source maps, observability, env secrets

## 🏃 Quick Start

```bash
# 1. Install dependencies
cd cryo-worker
pnpm install

# 2. Login to Cloudflare (required for D1)
npx wrangler login

# 3. Create local D1 database & run migrations
npx wrangler d1 execute cryo-db --local --file=./migrations/0001_initial_schema.sql
npx wrangler d1 execute cryo-db --local --file=./migrations/0002_add_password_hash.sql
npx wrangler d1 execute cryo-db --local --file=./migrations/0003_add_otp_tokens.sql
npx wrangler d1 execute cryo-db --local --file=./migrations/0004_add_mfa.sql
npx wrangler d1 execute cryo-db --local --file=./migrations/0005_add_blockchain_tables.sql

# 4. Generate TS types from bindings
npx wrangler types

# 5. Start local dev server
pnpm dev
```

**Test endpoints**:
- `GET /health` → `{"status":"ok"}`
- `GET /tables` → List D1 tables
- `GET /api/ethereum/health` → Ethereum RPC check

## 🏗️ Architecture

```
CryoPay Frontend → cryo-worker (Cloudflare Worker)
                    ↓ Hono Router + CORS/Logger
┌─────────────────────────────────────────────────────┐
│ Protected Routes:                                    │
│ /api/auth → Register/Login/MFA/MetaMask              │
│ /api/profile → User profile CRUD                     │
│ /api/wallet → Keys + verification                    │
│ /api/contacts → Contact management                   │
│ /api/blocks → Encrypted tx blocks                    │
│ /api/blockchain → Tx record/status/sync              │
│ /api/ethereum → RPC (balance/gas/network)            │
│ /api/dev → Development endpoints                     │ ← authMiddleware/JWT
└─────────────┬───────────────────────────────────────┘
              ↓
┌─────────────┼───────────────────────────────────────┐
│ D1 DB       │ Ethereum (Sepolia/Alchemy + viem)    │
│ • profiles  │ • CryoPayTransactionRecorder         │
│ • wallets   │ • Tx recording/events                 │
│ • ethereum_ │ • Balances/gas/nonce                 │
│   users     │                                     │
│ • txs/events│                                     │
└─────────────┴───────────────────────────────────────┘
```

**Env Bindings** (wrangler.jsonc):
| Binding | Type | Purpose |
|---------|------|---------|
| `DATABASE` | D1Database | SQLite (cryo-db) |
| `JWT_SECRET` | Secret | JWT signing (change in prod!) |
| `CRYOPAY_CONTRACT_ADDRESS` | Secret | Smart contract |
| `ETHEREUM_RPC_URL` | Secret | Alchemy Sepolia |
| `ETHEREUM_CHAIN_ID` | Var | 11155111 (Sepolia) |

## 📋 API Reference

All routes under `/api/*` require `Authorization: Bearer <JWT>` except public endpoints.

### Authentication `/api/auth`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | No | Create account + temp wallet |
| POST | `/login` | No | Email/password login |
| POST | `/mfa-login` | No | MFA login |
| POST | `/send-otp` | No | Email magic link |
| POST | `/verify-otp` | No | Verify magic link |
| POST | `/metamask/connect` | No | Link MetaMask |
| GET | `/metamask/nonce` | No | Generate sig nonce |

**Register Example**:
```json
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "securepass123",
  "first_name": "John",
  "public_key": "{\"kty\":\"EC\",\"crv\":\"P-256\",...}"
}
```

### Wallet `/api/wallet`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Yes | Get wallet |
| POST | `/` | Yes | Save/update keys |
| POST | `/verify-wallet` | Yes | Challenge-response verify |

### Blockchain `/api/blockchain`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/record` | Yes + EthSig | Record P2P tx |
| GET | `/status/:txHash` | No | Tx status + receipt |
| GET | `/transactions` | Yes | User tx history |
| GET | `/contract-transactions` | Yes | On-chain tx |
| POST | `/sync` | Yes | Sync contract events |

### Ethereum `/api/ethereum`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/gas-price` | No | Current gas |
| GET | `/balance/:addr` | No | ETH balance |
| GET | `/network` | No | Chain info |
| GET | `/contract-abi` | No | Contract ABI |

## 🗄️ Database Schema

**Core Tables**:
| Table | Purpose | Key Fields |
|-------|---------|------------|
| `profiles` | Users | id(UUID), email, password_hash(PBKDF2), mfa_secret(base32), mfa_backup_codes(JSON) |
| `wallets` | Keys | user_id, public_key(JWK), encrypted_private_key(JSON), verified |
| `ethereum_users` | Eth link | id, ethereum_address, verified, balance_wei |
| `blockchain_transactions` | Tx records | user_id, tx_hash, from/to, amount_wei, status |
| `contract_events` | Event index | event_name, block_number, from/to_address, tx_hash |
| `otp_tokens` | Magic links | email, token(UUID), expires_at, used |

**Migrations**: 0001-0005 (initial → blockchain tables).

## ⛓️ Smart Contract Integration

**CryoPayTransactionRecorder** (Sepolia: `0x9a14...CE75A`):
- `recordTransaction(txHash, from, to, amount, currency)`
- Events: `TransactionRecorded(from, to, amount, currency, txHash)`
- Methods: `isTransactionRecorded()`, `getTransactions()`, `getTotalTransactions()`

**Networks**:
| Network | Chain ID | Contract |
|---------|----------|----------|
| localhost | 31337 | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| sepolia | 11155111 | `0x9a142DBc7dec674E7b6d8175FcE40aAf88aCE75A` |

## 🔧 Development

```bash
# Generate types
pnpm types

# Run tests
pnpm test

# Dev with hot reload
pnpm dev

# Tail logs
npx wrangler tail
```

**Testing**: 100% coverage target – `pnpm vitest --coverage`.

**Linting**: Prettier/ESLint via `.prettierrc`/eslint.config.js.

## 🚀 Production Deployment

```bash
# Set secrets
npx wrangler secret put JWT_SECRET
npx wrangler secret put CRYOPAY_CONTRACT_ADDRESS
npx wrangler secret put ETHEREUM_RPC_URL

# Create prod D1
npx wrangler d1 create cryo-db

# Run prod migrations
npx wrangler d1 execute cryo-db --file=./migrations/*.sql

# Deploy
pnpm deploy
```

**Observability**: Enabled (Tail events, metrics, source maps).

## 🤝 Contributing

1. Fork → Branch → PR
2. `pnpm install && pnpm test`
3. Update tests + types
4. Follow Zod/Hono patterns

**Issues**: [Create Issue](https://github.com/yourorg/cryopay/issues/new)

## 📄 License

MIT – See [LICENSE](LICENSE) for details.

---

*Built with ❤️ for CryoPay by BLACKBOXAI*

