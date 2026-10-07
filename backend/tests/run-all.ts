import { spawn } from 'child_process';
import http from 'http';

function checkServerReady(url: string, timeout = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      http.get(url, (res) => {
        clearInterval(interval);
        resolve();
      }).on('error', (err) => {
        if (Date.now() - start > timeout) {
          clearInterval(interval);
          reject(new Error('Server did not start in time.'));
        }
      });
    }, 500);
  });
}

function runScript(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: 'inherit', shell: true });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command ${command} ${args.join(' ')} failed with code ${code}`));
    });
  });
}

async function runAllTests() {
  console.log('--- STARTING BACKEND TESTS ---');
  
  // Start server
  console.log('Starting server in background...');
  const serverProc = spawn('npx.cmd', ['tsx', 'src/server.ts'], { shell: true, stdio: 'pipe' });
  
  try {
    console.log('Waiting for server to become ready...');
    await checkServerReady('http://localhost:3000/api/events');
    console.log('Server is ready. Running integration tests...');

    await runScript('npx.cmd', ['tsx', '-r', 'dotenv/config', 'tests/test-api.ts']);
    await runScript('npx.cmd', ['tsx', '-r', 'dotenv/config', 'tests/test-nlp-pipeline.ts']);
    await runScript('npx.cmd', ['tsx', '-r', 'dotenv/config', 'tests/test-provider-direct.ts']);
    
    console.log('\n--- ALL BACKEND TESTS PASSED ---');
  } catch (err: any) {
    console.error('\n--- TEST RUN FAILED ---');
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    console.log('Shutting down server...');
    serverProc.kill();
  }
}

runAllTests();
