#!/usr/bin/env node
import { run } from '../dist/cli.js';

async function main() {
  await run();
}

main().catch((e) => {
  console.error('🚨 [vessel] installation failed', '\n\n', e, '\n');
  process.exit(1);
});
