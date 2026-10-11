# Free deployment: Vercel Hobby + Render Free

This setup is for a personal/demo deployment, not production. The Vercel frontend is static; the Render backend runs on a free web service and PostgreSQL is hosted separately.

## 1. Create a free PostgreSQL database

Use a PostgreSQL provider with a free plan, such as Neon Free. Create a database and copy its PostgreSQL connection string. Keep the credentials private. Free database quotas, storage limits, and inactivity behavior can change; check the provider's current plan details and keep a backup of anything important.

Render's free web service has an ephemeral filesystem and sleeps after inactivity. Do not store database files or persistent user uploads on its local filesystem.

## 2. Deploy the backend on Render Free

1. Push the repository to GitHub and create a Render Blueprint using [render.yaml](./render.yaml).
2. The Blueprint selects Render's **Free** web-service plan. Provide the `DATABASE_URL` for the PostgreSQL database you created.
3. The deployment intentionally skips downloading the two large ONNX models. It sets `NLP_MODE=development` and `NLP_PROVIDER=development`, which selects rule-based NLP so the small free instance can start without model weights.
4. After the first deploy, open `https://<your-render-service>.onrender.com/api/health`; it should return `{"status":"ok"}`.
5. Copy the Render service URL for the frontend setup.

The free Render instance spins down after about 15 minutes without traffic; the next request can take about a minute while it starts. Its filesystem is temporary. The health endpoint is a liveness check and does not test the database. Database failures are reported by API operations.

## 3. Prepare the database schema

Before using the app, initialize the schema in `backend/prisma/schema.prisma`. For a newly created, empty demo database, run `npx prisma db push` from `backend` with `DATABASE_URL` set to that database. This repository's migrations may not fully initialize every schema model. For an existing database, inspect its migration history and schema and take a backup first; do not run `db push` blindly.

## 4. Deploy the frontend on Vercel Hobby

1. Import the GitHub repository into Vercel with the project root set to the repository root. [vercel.json](./vercel.json) configures the Vite build, `dist` output, and SPA route fallback.
2. Add the `VITE_API_URL` environment variable. Set its value to the Render URL followed by `/api`, for example `https://vantage-api.onrender.com/api`.
3. Deploy, then open the Vercel URL and check that API-backed pages load. Redeploy whenever you change `VITE_API_URL`.

Vercel Hobby is free for eligible personal projects. Check Vercel's current Hobby terms and usage limits to confirm they fit your use.

## What the free setup does not provide

- FinBERT sentiment and the fine-tuned event classifier are disabled. Rule-based NLP is less accurate and must not be relied on for investment or risk decisions. The API labels stored event explanations as development estimates and caps confidence scores.
- The API currently allows cross-origin requests and has no authentication. Do not store sensitive or real client portfolio data in this demo.
- Free services may sleep, have limited compute/storage/quotas, and are not a production availability or durability tier. Keep backups and expect cold starts.

## If you later upgrade the backend

To use the local ONNX models, upload these files to private storage with direct HTTPS download URLs:

- `backend/models/nlp/phase1d-finbert/onnx/model.onnx` — SHA-256 `12a6294a7ea4aba6d7cf519c458e6cff9ed21cbcf3e8e7cd43f8859fc33c69f7`
- `backend/models/nlp/phase2-event-classifier/onnx/model.onnx` — SHA-256 `b2a0fb1d5a2a17cf7eed726fec9c88e4debc96d8e5a683b5a95d6921c2519f25`

Set `FINBERT_MODEL_URL` and `PHASE2_EVENT_MODEL_URL` as Render build environment variables, add `npm run models:download` to the build command before `npx prisma generate`, and choose a paid instance with substantially more memory. Remove `NLP_MODE=development` to enable the ONNX inference path.
