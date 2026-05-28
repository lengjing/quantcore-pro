import { existsSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const sourceRoot = path.join(root, 'packages', 'free-claude-code');
const runtimeRoot = path.join(root, 'runtime', 'free-claude-code');
const entry = path.join(sourceRoot, 'server.py');

if (!existsSync(entry)) {
  console.error(`[free-claude-runtime] Missing entry: ${entry}`);
  process.exit(1);
}

function killRunningProxyOnWindows() {
  if (process.platform !== 'win32') {
    return;
  }

  // Avoid EBUSY when previous local test keeps the runtime executable open.
  spawnSync('taskkill', ['/IM', 'free-claude-proxy.exe', '/F', '/T'], {
    stdio: 'ignore',
    shell: true,
  });
}

function safeRm(targetPath, options = { recursive: true, force: true }) {
  const attempts = 6;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      rmSync(targetPath, options);
      return;
    } catch (error) {
      const code = error?.code;
      if ((code === 'EBUSY' || code === 'EPERM') && attempt < attempts) {
        const waitUntil = Date.now() + attempt * 250;
        while (Date.now() < waitUntil) {
          // Busy wait in a short bounded window to keep script dependency-free.
        }
        continue;
      }
      throw error;
    }
  }
}

killRunningProxyOnWindows();

mkdirSync(runtimeRoot, { recursive: true });
safeRm(path.join(runtimeRoot, 'build'));
safeRm(path.join(runtimeRoot, 'dist'));
safeRm(path.join(runtimeRoot, 'free-claude-proxy.spec'), { force: true });

const dataSep = process.platform === 'win32' ? ';' : ':';
const adminStatic = `${path.join(sourceRoot, 'api', 'admin_static')}${dataSep}api/admin_static`;
const envExample = `${path.join(sourceRoot, '.env.example')}${dataSep}.env.example`;

const pythonBin = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
const pyArgs = [
  '-m',
  'PyInstaller',
  '--noconfirm',
  '--onedir',
  '--name',
  'free-claude-proxy',
  '--distpath',
  path.join(runtimeRoot, 'dist'),
  '--workpath',
  path.join(runtimeRoot, 'build'),
  '--specpath',
  runtimeRoot,
  '--paths',
  sourceRoot,
  '--add-data',
  adminStatic,
  '--add-data',
  envExample,
  '--collect-data',
  'tiktoken',
  '--collect-data',
  'tiktoken_ext',
  '--hidden-import',
  'tiktoken_ext.openai_public',
  entry,
];

console.log(`[free-claude-runtime] Building PyInstaller runtime with ${pythonBin}...`);
const result = spawnSync(pythonBin, pyArgs, {
  stdio: 'inherit',
  cwd: sourceRoot,
  env: process.env,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const distDir = path.join(runtimeRoot, 'dist', 'free-claude-proxy');
if (!existsSync(distDir)) {
  console.error(`[free-claude-runtime] Build output missing: ${distDir}`);
  process.exit(1);
}

const exampleSrc = path.join(sourceRoot, '.env.example');
const exampleDst = path.join(distDir, '.env.example');
if (existsSync(exampleSrc) && !existsSync(exampleDst)) {
  copyFileSync(exampleSrc, exampleDst);
}

console.log(`[free-claude-runtime] Ready: ${distDir}`);
