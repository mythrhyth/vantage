# Deploy VANTAGE

VANTAGE deploys as a Vite frontend on Vercel and an Express API on Render. The backend requires PostgreSQL and two model files that are intentionally excluded from Git (about 836 MiB combined).

## 1. Prepare the model files

Upload these local files to private object storage that can provide direct HTTPS downloads:

- `backend/models/nlp/phase1d-finbert/onnx/model.onnx`
- `backend/models/nlp/phase2-event-classifier/onnx/model.onnx`

Use URLs that return the files themselves, not an HTML download page. The Render build downloads each file and verifies its SHA-256 before starting:

- FinBERT: `12a6294a7ea4aba6d7cf519c458e6cff9ed21cbcf3e8e7cd43f8859fc33c69f7`
- Event classifier: `b2a0fb1d5a2a17cf7ebd726fec9c88e4debc96d8e5a683b5a95d6921c2519f25`

Keep the storage private and use stable URLs or long-lived signed URLs; add them as Render build environment variables in the next step. Do not commit model weights or access tokens.

## 2. Deploy the backend to Render

1. Create a Render Blueprint from this GitHub repository and select `render.yaml`.
2. Set the prompted `DATABASE_URL` to the PostgreSQL connection string for the intended database. Set `FINBERT_MODEL_URL` and `PHASE2_EVENT_MODEL_URL` to the HTTPS model download URLs.
3. Review the service settings. The backend build installs dependencies, downloads and verifies both models, and generates Prisma Client. Render starts it with `npm start`; `/api/health` checks database connectivity.
4. Before using the service, ensure the database schema is at the expected version. For a new database, review the checked-in Prisma migrations and run `npx prisma migrate deploy` from `backend` against that database. For an existing database, verify its migration history and schema first; do not run `db push` blindly against production.
5. Choose a Render instance with enough memory for the API and both local ONNX models. The model files total about 836 MiB, and inference needs additional memory; a 2 GiB-or-larger instance is a safer starting point than a 512 MiB instance.
6. Wait for `/api/health` to report `{"status":"ok","database":"connected"}` and copy the Render service URL.

`GEMINI_API_KEY` is optional and should only be added as a Render secret if you want Gemini-backed explanations. Without it, the service uses its rule-based provider and local ONNX analysis.

## 3. Deploy the frontend to Vercel

1. Import the same GitHub repository into Vercel. Keep the project root at the repository root; `vercel.json` configures the Vite build, `dist` output, and SPA route fallback.
2. Add `VITE_API_URL` for Production, Preview, and Development as appropriate. Its value must be the Render service URL followed by `/api`, for example `https://vantage-api.onrender.com/api`.
3. Deploy. Vite embeds `VITE_API_URL` at build time, so redeploy after changing it.
4. Open the Vercel site and confirm its data loads from the Render API.

## Important before production use

The API currently enables CORS for all origins and does not authenticate users. CORS is not access control: anyone who can reach the API may call its write endpoints. Do not put sensitive or production portfolio data behind this deployment until authentication and authorization are added. Also verify your database backup and migration plan before applying schema changes.
