#!/usr/bin/env node

import argv from '@prokopschield/argv';
import fs from 'fs';

import { blake2bFinal, blake2bInit, blake2bUpdate } from './blake2b';
import { blake2sFinal, blake2sInit, blake2sUpdate } from './blake2s';

const { file, outlen, encoding, newline } = argv
	.alias('file', 'f', 'i', 'input')
	.alias('outlen', 'l')
	.alias('encoding', 'e', 'o', 'output', 'coding', 'hex', 'base64')
	.alias('newline', 'n', 'nl')
	.expect(['file', 'outlen', 'encoding', 'newline'], {
		encoding: process.stdout.isTTY ? 'hex' : '',
	});

const inputStream = file ? fs.createReadStream(file) : process.stdin;

const use2b = argv.execScript.includes('2b');

const functions = use2b
	? { init: blake2bInit, update: blake2bUpdate, finalize: blake2bFinal }
	: { init: blake2sInit, update: blake2sUpdate, finalize: blake2sFinal };

const context = functions.init(Number(outlen) || 0);

inputStream.on('data', (chunk: Buffer) => functions.update(context, chunk));

inputStream.on('end', () => {
	const output = functions.finalize(context);
	const print = newline
		? console.log
		: process.stdout.write.bind(process.stdout);
	print(
		encoding === 'hex' || encoding === 'base64'
			? Buffer.from(output).toString(encoding)
			: output
	);
});
