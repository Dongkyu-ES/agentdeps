#!/usr/bin/env node
import { main } from '../packages/cli/src/cli.js';

main(process.argv.slice(2)).catch((error) => {
  const message = error && error.message ? error.message : String(error);
  console.error(`mad: ${message}`);
  process.exitCode = 1;
});
