#!/usr/bin/env node

import { blake2bHex, blake2sHex } from '.';

const input = process.argv.slice(2).join(' ');

console.log(`blake2b: ${blake2bHex(input)}`);
console.log(`blake2s: ${blake2sHex(input)}`);
