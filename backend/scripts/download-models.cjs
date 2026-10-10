const { createHash } = require('node:crypto');
const { createWriteStream } = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { Readable } = require('node:stream');

const MAX_MODEL_BYTES = 1024 * 1024 * 1024;
const models = [
  {
    name: 'FinBERT sentiment',
    urlVariable: 'FINBERT_MODEL_URL',
    sha256: '12a6294a7ea4aba6d7cf519c458e6cff9ed21cbcf3e8e7cd43f8859fc33c69f7',
    destination: path.join(__dirname, '..', 'models', 'nlp', 'phase1d-finbert', 'onnx', 'model.onnx'),
  },
  {
    name: 'Phase 2 event classifier',
    urlVariable: 'PHASE2_EVENT_MODEL_URL',
    sha256: 'b2a0fb1d5a2a17cf7eed726fec9c88e4debc96d8e5a683b5a95d6921c2519f25',
    destination: path.join(__dirname, '..', 'models', 'nlp', 'phase2-event-classifier', 'onnx', 'model.onnx'),
  },
];

async function downloadModel(model) {
  const source = process.env[model.urlVariable];
  if (!source) {
    throw new Error(`${model.urlVariable} must point to the matching ONNX model file.`);
  }

  let url;
  try {
    url = new URL(source);
  } catch {
    throw new Error(`${model.urlVariable} must be a valid HTTPS URL.`);
  }
  if (url.protocol !== 'https:') {
    throw new Error(`${model.urlVariable} must use HTTPS.`);
  }

  const response = await fetch(url);
  if (!response.ok || !response.body || new URL(response.url).protocol !== 'https:') {
    throw new Error(`Could not securely download ${model.name} (HTTP ${response.status}).`);
  }
  if (response.headers.get('content-type')?.includes('text/html')) {
    throw new Error(`The ${model.name} URL returned HTML instead of a model file.`);
  }

  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_MODEL_BYTES) {
    throw new Error(`${model.name} exceeds the 1 GiB download limit.`);
  }

  await fs.mkdir(path.dirname(model.destination), { recursive: true });
  const temporaryPath = `${model.destination}.download`;
  const hash = createHash('sha256');
  let bytesWritten = 0;
  const verifyStream = new Transform({
    transform(chunk, _encoding, callback) {
      bytesWritten += chunk.length;
      if (bytesWritten > MAX_MODEL_BYTES) {
        callback(new Error(`${model.name} exceeds the 1 GiB download limit.`));
        return;
      }
      hash.update(chunk);
      callback(null, chunk);
    },
  });

  try {
    await pipeline(Readable.fromWeb(response.body), verifyStream, createWriteStream(temporaryPath));
    const actualHash = hash.digest('hex');
    if (bytesWritten < 100 * 1024 * 1024 || actualHash !== model.sha256) {
      throw new Error(`${model.name} failed size or SHA-256 verification.`);
    }
    await fs.rename(temporaryPath, model.destination);
    console.log(`Verified and installed ${model.name} (${Math.round(bytesWritten / 1024 / 1024)} MiB).`);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true });
    throw error;
  }
}

async function main() {
  for (const model of models) {
    await downloadModel(model);
  }
}

main().catch((error) => {
  console.error(`Model setup failed: ${error.message}`);
  process.exitCode = 1;
});
