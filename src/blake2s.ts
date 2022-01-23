// BLAKE2s hash function in pure Javascript
// Adapted from the reference implementation in RFC7693
// Ported to Javascript by DC - https://github.com/dcposch

import { normalizeInput, toHex } from './util';
import type { Hashable } from './util';

/**
 * Little-endian byte access
 * @returns the little-endian uint32 at v[i..i+3]
 */
export function B2S_GET32(v: Uint8Array, i: number) {
	return v[i] ^ (v[i + 1] << 8) ^ (v[i + 2] << 16) ^ (v[i + 3] << 24);
}

/**
 * Mixing function G.
 */
export function B2S_G(
	a: number,
	b: number,
	c: number,
	d: number,
	x: number,
	y: number
) {
	v[a] = v[a] + v[b] + x;
	v[d] = ROTR32(v[d] ^ v[a], 16);
	v[c] = v[c] + v[d];
	v[b] = ROTR32(v[b] ^ v[c], 12);
	v[a] = v[a] + v[b] + y;
	v[d] = ROTR32(v[d] ^ v[a], 8);
	v[c] = v[c] + v[d];
	v[b] = ROTR32(v[b] ^ v[c], 7);
}

/**
 * 32-bit right rotation
 * @param x uint32
 * @param y between 1 and 31, inclusive
 */
export function ROTR32(x: number, y: number) {
	return (x >>> y) ^ (x << (32 - y));
}

/**
 * Initialization Vector
 */
export const BLAKE2S_IV = new Uint32Array([
	0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
	0x1f83d9ab, 0x5be0cd19,
]);

export const SIGMA = new Uint8Array([
	0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 14, 10, 4, 8, 9, 15,
	13, 6, 1, 12, 0, 2, 11, 7, 5, 3, 11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6,
	7, 1, 9, 4, 7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8, 9, 0, 5,
	7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13, 2, 12, 6, 10, 0, 11, 8, 3, 4,
	13, 7, 5, 15, 14, 1, 9, 12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8,
	11, 13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10, 6, 15, 14, 9, 11,
	3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5, 10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14,
	3, 12, 13, 0,
]);

export interface Blake2sCTX {
	h: Uint32Array; // Hash state
	b: Uint8Array; // Pointer within block
	c: number; // pointer within block
	t: number; // input count
	outlen: number; // output length in bytes
}

const v = new Uint32Array(16);
const m = new Uint32Array(16);

/**
 * Compress in streaming hash
 * @param ctx hashing context
 * @param last indicates, whether the block is the last block
 */
export function blake2sCompress(ctx: Blake2sCTX, last?: boolean) {
	var i = 0;
	for (i = 0; i < 8; i++) {
		// init work variables
		v[i] = ctx.h[i];
		v[i + 8] = BLAKE2S_IV[i];
	}

	v[12] ^= ctx.t; // low 32 bits of offset
	v[13] ^= ctx.t / 0x100000000; // high 32 bits
	if (last) {
		// last block flag set ?
		v[14] = ~v[14];
	}

	for (i = 0; i < 16; i++) {
		// get little-endian words
		m[i] = B2S_GET32(ctx.b, 4 * i);
	}

	// ten rounds of mixing
	// uncomment the DebugPrint calls to log the computation
	// and match the RFC sample documentation
	// util.debugPrint('          m[16]', m, 32)
	for (i = 0; i < 10; i++) {
		// util.debugPrint('   (i=' + i + ')  v[16]', v, 32)
		B2S_G(0, 4, 8, 12, m[SIGMA[i * 16 + 0]], m[SIGMA[i * 16 + 1]]);
		B2S_G(1, 5, 9, 13, m[SIGMA[i * 16 + 2]], m[SIGMA[i * 16 + 3]]);
		B2S_G(2, 6, 10, 14, m[SIGMA[i * 16 + 4]], m[SIGMA[i * 16 + 5]]);
		B2S_G(3, 7, 11, 15, m[SIGMA[i * 16 + 6]], m[SIGMA[i * 16 + 7]]);
		B2S_G(0, 5, 10, 15, m[SIGMA[i * 16 + 8]], m[SIGMA[i * 16 + 9]]);
		B2S_G(1, 6, 11, 12, m[SIGMA[i * 16 + 10]], m[SIGMA[i * 16 + 11]]);
		B2S_G(2, 7, 8, 13, m[SIGMA[i * 16 + 12]], m[SIGMA[i * 16 + 13]]);
		B2S_G(3, 4, 9, 14, m[SIGMA[i * 16 + 14]], m[SIGMA[i * 16 + 15]]);
	}
	// util.debugPrint('   (i=10) v[16]', v, 32)

	for (i = 0; i < 8; i++) {
		ctx.h[i] ^= v[i] ^ v[i + 8];
	}
	// util.debugPrint('h[8]', ctx.h, 32)
}

/**
 * Creates a Blake2s hashing context
 * @param outlen between 1 and 32
 * @param key optional Uint8Array key
 * @returns {Blake2sCTX}
 */
export function blake2sInit(outlen: number, key?: Uint8Array): Blake2sCTX {
	if (!(outlen > 0 && outlen <= 32)) {
		outlen = 32;
	}
	const keylen = key ? key.length : 0;

	var ctx: Blake2sCTX = {
		h: new Uint32Array(BLAKE2S_IV),
		b: new Uint8Array(64),
		c: 0,
		t: 0,
		outlen,
	};
	ctx.h[0] ^= 0x01010000 ^ (keylen << 8) ^ outlen;

	if (key && keylen) {
		blake2sUpdate(ctx, key);
		ctx.c = 64; // at the end
	}

	return ctx;
}

/**
 * Updates a Blake2s streaming hash
 * @param ctx hash context
 * @param input byte array
 */
export function blake2sUpdate(ctx: Blake2sCTX, input: Uint8Array) {
	for (var i = 0; i < input.length; i++) {
		if (ctx.c === 64) {
			// buffer full ?
			ctx.t += ctx.c; // add counters
			blake2sCompress(ctx, false); // compress (not last)
			ctx.c = 0; // counter to zero
		}
		ctx.b[ctx.c++] = input[i];
	}
}

/**
 * Completes a Blake2s streaming hash
 * @param ctx hash context
 * @returns Uint8Array containing the message digest
 */
export function blake2sFinal(ctx: Blake2sCTX) {
	ctx.t += ctx.c; // mark last block offset
	while (ctx.c < 64) {
		// fill up with zeros
		ctx.b[ctx.c++] = 0;
	}
	blake2sCompress(ctx, true); // final block flag = 1

	// little endian convert and store
	var out = new Uint8Array(ctx.outlen);
	for (var i = 0; i < ctx.outlen; i++) {
		out[i] = (ctx.h[i >> 2] >> (8 * (i & 3))) & 0xff;
	}
	return out;
}

/**
 * Computes the Blake2s hash of a string or byte array, and returns a Uint8Array
 * @param input the input bytes, as a string, Buffer, or Uint8Array
 * @param key optional key Uint8Array, up to 32 bytes
 * @param outlen optional output length in bytes, defaults to 64
 * @returns an n-byte Uint8Array
 */
export function blake2s(input: Hashable, key?: Uint8Array, outlen?: number) {
	// preprocess inputs
	outlen = outlen || 32;
	// do the math
	var ctx = blake2sInit(outlen, key);
	blake2sUpdate(ctx, normalizeInput(input));
	return blake2sFinal(ctx);
}

/**
 *
 * @param input the input bytes, as a string, Buffer, or Uint8Array
 * @param key optional key Uint8Array, up to 32 bytes
 * @param outlen optional output length in bytes, defaults to 64
 * @returns
 */
export function blake2sHex(input: Hashable, key?: Uint8Array, outlen?: number) {
	var output = blake2s(input, key, outlen);
	return toHex(output);
}

/**
 *
 * @param input the input bytes, as a string, Buffer, or Uint8Array
 * @param key optional key Uint8Array, up to 32 bytes
 * @param outlen optional output length in bytes, defaults to 64
 * @returns the hash, as a bigint
 */
export function blake2sBigInt(
	input: Hashable,
	key?: Uint8Array,
	outlen?: number
) {
	var sixty_four = BigInt(64);
	var output = blake2s(input, key, outlen);
	var bigIntArray = new BigUint64Array(output.buffer);
	var res = BigInt(0);
	for (const n of bigIntArray) {
		res <<= sixty_four;
		res += n;
	}
	return res;
}
