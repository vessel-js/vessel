import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const vesselPkgPath = path.resolve(__dirname, '../../package.json');

const vesselPkgContent = JSON.parse(
  fs.readFileSync(vesselPkgPath, 'utf-8'),
);

export function getVersion() {
  return vesselPkgContent.version;
}

export async function getNodeMajorVersion() {
  const nodeV = await promisify(exec)('node -v');
  return parseInt(nodeV.stdout.slice(1).split('.')[0]);
}
