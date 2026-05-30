import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const pythonSource = path.join(root, 'python');
const runtimeRoot = path.join(root, 'runtime', 'python');
const installDir = path.join(runtimeRoot, 'install');
const venvDir = path.join(runtimeRoot, 'venv');
const appDir = path.join(runtimeRoot, 'app');

const RELEASE_TAG = process.env.PYTHON_STANDALONE_TAG || '20251202';
const PYTHON_VERSION = process.env.PYTHON_STANDALONE_VERSION || '3.12.12';
const BASE_URL = `https://github.com/astral-sh/python-build-standalone/releases/download/${RELEASE_TAG}`;

if (!existsSync(path.join(pythonSource, 'main.py'))) {
  console.error(`[python-runtime] Missing entry: ${path.join(pythonSource, 'main.py')}`);
  process.exit(1);
}

function platformAssetName() {
  const { platform, arch } = process;

  if (platform === 'win32') {
    if (arch === 'x64') return `cpython-${PYTHON_VERSION}+${RELEASE_TAG}-x86_64-pc-windows-msvc-install_only_stripped.tar.gz`;
    if (arch === 'arm64') return `cpython-${PYTHON_VERSION}+${RELEASE_TAG}-aarch64-pc-windows-msvc-install_only_stripped.tar.gz`;
  }

  if (platform === 'darwin') {
    if (arch === 'arm64') return `cpython-${PYTHON_VERSION}+${RELEASE_TAG}-aarch64-apple-darwin-install_only_stripped.tar.gz`;
    if (arch === 'x64') return `cpython-${PYTHON_VERSION}+${RELEASE_TAG}-x86_64-apple-darwin-install_only_stripped.tar.gz`;
  }

  if (platform === 'linux') {
    if (arch === 'x64') return `cpython-${PYTHON_VERSION}+${RELEASE_TAG}-x86_64-unknown-linux-gnu-install_only_stripped.tar.gz`;
    if (arch === 'arm64') return `cpython-${PYTHON_VERSION}+${RELEASE_TAG}-aarch64-unknown-linux-gnu-install_only_stripped.tar.gz`;
  }

  throw new Error(`[python-runtime] Unsupported platform: ${platform}/${arch}`);
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function embeddedPythonBin() {
  if (process.platform === 'win32') {
    return path.join(installDir, 'python', 'python.exe');
  }
  return path.join(installDir, 'python', 'bin', 'python3');
}

function venvPythonBin() {
  if (process.platform === 'win32') {
    return path.join(venvDir, 'Scripts', 'python.exe');
  }
  return path.join(venvDir, 'bin', 'python3');
}

function downloadFile(url, dest) {
  console.log(`[python-runtime] Downloading ${url}`);
  if (process.platform === 'win32') {
    run('powershell', [
      '-NoProfile',
      '-Command',
      `Invoke-WebRequest -Uri '${url}' -OutFile '${dest}' -UseBasicParsing`,
    ]);
    return;
  }
  run('curl', ['-fL', url, '-o', dest]);
}

mkdirSync(runtimeRoot, { recursive: true });

const archiveName = platformAssetName();
const archivePath = path.join(runtimeRoot, archiveName);
const embeddedBin = embeddedPythonBin();

if (!existsSync(embeddedBin)) {
  rmSync(installDir, { recursive: true, force: true });
  mkdirSync(installDir, { recursive: true });

  if (!existsSync(archivePath)) {
    downloadFile(`${BASE_URL}/${archiveName}`, archivePath);
  }

  console.log(`[python-runtime] Extracting ${archiveName}`);
  run('tar', ['-xzf', archivePath, '-C', installDir]);
}

if (!existsSync(embeddedBin)) {
  console.error(`[python-runtime] Embedded Python not found at ${embeddedBin}`);
  process.exit(1);
}

if (!existsSync(venvPythonBin())) {
  console.log('[python-runtime] Creating virtual environment...');
  rmSync(venvDir, { recursive: true, force: true });
  run(embeddedBin, ['-m', 'venv', venvDir]);
}

console.log('[python-runtime] Installing dependencies...');
run(venvPythonBin(), ['-m', 'pip', 'install', '--upgrade', 'pip']);
run(venvPythonBin(), ['-m', 'pip', 'install', '-r', path.join(pythonSource, 'requirements.txt')]);

rmSync(appDir, { recursive: true, force: true });
cpSync(pythonSource, appDir, {
  recursive: true,
  filter: (src) => !src.includes('__pycache__') && !src.endsWith('.pyc'),
});

// Stamp runtime metadata for diagnostics.
const meta = {
  pythonVersion: PYTHON_VERSION,
  releaseTag: RELEASE_TAG,
  platform: process.platform,
  arch: process.arch,
  builtAt: new Date().toISOString(),
};
writeFileSync(path.join(runtimeRoot, 'runtime-meta.json'), JSON.stringify(meta, null, 2));

console.log(`[python-runtime] Ready: venv=${venvDir} app=${appDir}`);
