// Blake2B in pure TypeScript
// Adapted from the reference implementation in RFC7693
// Ported to Javascript by DC - https://github.com/dcposch
// Type annotations added by Prokop Schield - https://github.com/prokopschield

import { normalizeInput, toHex } from './util';
import type { Hashable } from './util';

/**
 * 64-bit unsigned addition
 * Sets v[a, a+1] += v[b, b+1]
 */
export function ADD64AA(v: Uint32Array, a: number, b: number): Uint32Array {
	var o0 = v[a] + v[b];
	var o1 = v[a + 1] + v[b + 1];
	if (o0 >= 0x100000000) {
		o1++;
	}
	v[a] = o0;
	v[a + 1] = o1;
	return v;
}

/**
 * 64-bit unsigned addition
 * Set v[a, a+1] += b
 * @param b0 the low 32 bits of b
 * @param b1 the high 32 bits of b
 * @returns
 */
export function ADD64AC(
	v: Uint32Array,
	a: number,
	b0: number,
	b1: number
): Uint32Array {
	var o0 = v[a] + b0;
	if (b0 < 0) {
		o0 += 0x100000000;
	}
	var o1 = v[a + 1] + b1;
	if (o0 >= 0x100000000) {
		o1++;
	}
	v[a] = o0;
	v[a + 1] = o1;
	return v;
}

/**
 * Little-endian byte access
 */
export function B2B_GET32(arr: Uint8Array, i: number): number {
	return arr[i] ^ (arr[i + 1] << 8) ^ (arr[i + 2] << 16) ^ (arr[i + 3] << 24);
}

/**
 * G Mixing function
 * ROTRs are inlined to increase performance
 */
export function B2B_G(
	a: number,
	b: number,
	c: number,
	d: number,
	ix: number,
	iy: number
) {
	var x0 = m[ix];
	var x1 = m[ix + 1];
	var y0 = m[iy];
	var y1 = m[iy + 1];

	ADD64AA(v, a, b); // v[a,a+1] += v[b,b+1] ... in JS we must store a uint64 as two uint32s
	ADD64AC(v, a, x0, x1); // v[a, a+1] += x ... x0 is the low 32 bits of x, x1 is the high 32 bits

	// v[d,d+1] = (v[d,d+1] xor v[a,a+1]) rotated to the right by 32 bits
	var xor0 = v[d] ^ v[a];
	var xor1 = v[d + 1] ^ v[a + 1];
	v[d] = xor1;
	v[d + 1] = xor0;

	ADD64AA(v, c, d);

	// v[b,b+1] = (v[b,b+1] xor v[c,c+1]) rotated right by 24 bits
	xor0 = v[b] ^ v[c];
	xor1 = v[b + 1] ^ v[c + 1];
	v[b] = (xor0 >>> 24) ^ (xor1 << 8);
	v[b + 1] = (xor1 >>> 24) ^ (xor0 << 8);

	ADD64AA(v, a, b);
	ADD64AC(v, a, y0, y1);

	// v[d,d+1] = (v[d,d+1] xor v[a,a+1]) rotated right by 16 bits
	xor0 = v[d] ^ v[a];
	xor1 = v[d + 1] ^ v[a + 1];
	v[d] = (xor0 >>> 16) ^ (xor1 << 16);
	v[d + 1] = (xor1 >>> 16) ^ (xor0 << 16);

	ADD64AA(v, c, d);

	// v[b,b+1] = (v[b,b+1] xor v[c,c+1]) rotated right by 63 bits
	xor0 = v[b] ^ v[c];
	xor1 = v[b + 1] ^ v[c + 1];
	v[b] = (xor1 >>> 31) ^ (xor0 << 1);
	v[b + 1] = (xor0 >>> 31) ^ (xor1 << 1);
}

/**
 * Initialization Vector
 */
export const BLAKE2B_IV32 = new Uint32Array([
	0xf3bcc908, 0x6a09e667, 0x84caa73b, 0xbb67ae85, 0xfe94f82b, 0x3c6ef372,
	0x5f1d36f1, 0xa54ff53a, 0xade682d1, 0x510e527f, 0x2b3e6c1f, 0x9b05688c,
	0xfb41bd6b, 0x1f83d9ab, 0x137e2179, 0x5be0cd19,
]);

export const SIGMA8 = [
	0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 14, 10, 4, 8, 9, 15,
	13, 6, 1, 12, 0, 2, 11, 7, 5, 3, 11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6,
	7, 1, 9, 4, 7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8, 9, 0, 5,
	7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13, 2, 12, 6, 10, 0, 11, 8, 3, 4,
	13, 7, 5, 15, 14, 1, 9, 12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8,
	11, 13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10, 6, 15, 14, 9, 11,
	3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5, 10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14,
	3, 12, 13, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 14, 10,
	4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3,
];

/**
 * These are offsets into a uint64 buffer.
 * Multiply them all by 2 to make them offsets into a uint32 buffer,
 * because this is JavaScript and we don't have uint64s
 */
export const SIGMA82 = new Uint8Array(
	SIGMA8.map(function (x) {
		return x * 2;
	})
);

const v = new Uint32Array(32);
const m = new Uint32Array(32);

/**
 * Compressing function.
 * We're representing 16 Uint64s as 32 Uint32s.
 * @param ctx the hashing context
 * @param last Is this the last block?
 */
export function blake2bCompress(ctx: Blake2bCTX, last?: boolean) {
	var i = 0;

	// init work variables
	for (i = 0; i < 16; i++) {
		v[i] = ctx.h[i];
		v[i + 16] = BLAKE2B_IV32[i];
	}

	// low 64 bits of offset
	v[24] = v[24] ^ ctx.t;
	v[25] = v[25] ^ (ctx.t / 0x100000000);
	// high 64 bits not supported, offset may not be higher than 2**53-1

	// last block flag set ?
	if (last) {
		v[28] = ~v[28];
		v[29] = ~v[29];
	}

	// get little-endian words
	for (i = 0; i < 32; i++) {
		m[i] = B2B_GET32(ctx.b, 4 * i);
	}

	// twelve rounds of mixing
	// uncomment the DebugPrint calls to log the computation
	// and match the RFC sample documentation
	// util.debugPrint('          m[16]', m, 64)
	for (i = 0; i < 12; i++) {
		// util.debugPrint('   (i=' + (i < 10 ? ' ' : '') + i + ') v[16]', v, 64)
		B2B_G(0, 8, 16, 24, SIGMA82[i * 16 + 0], SIGMA82[i * 16 + 1]);
		B2B_G(2, 10, 18, 26, SIGMA82[i * 16 + 2], SIGMA82[i * 16 + 3]);
		B2B_G(4, 12, 20, 28, SIGMA82[i * 16 + 4], SIGMA82[i * 16 + 5]);
		B2B_G(6, 14, 22, 30, SIGMA82[i * 16 + 6], SIGMA82[i * 16 + 7]);
		B2B_G(0, 10, 20, 30, SIGMA82[i * 16 + 8], SIGMA82[i * 16 + 9]);
		B2B_G(2, 12, 22, 24, SIGMA82[i * 16 + 10], SIGMA82[i * 16 + 11]);
		B2B_G(4, 14, 16, 26, SIGMA82[i * 16 + 12], SIGMA82[i * 16 + 13]);
		B2B_G(6, 8, 18, 28, SIGMA82[i * 16 + 14], SIGMA82[i * 16 + 15]);
	}
	// util.debugPrint('   (i=12) v[16]', v, 64)

	for (i = 0; i < 16; i++) {
		ctx.h[i] = ctx.h[i] ^ v[i] ^ v[i + 16];
	}
	// util.debugPrint('h[8]', ctx.h, 64)
}

export interface Blake2bCTX {
	b: Uint8Array;
	h: Uint32Array;
	t: number;
	c: number;
	outlen: number;
}

/**
 * Creates a Blake2b hashing context
 * @param outlen between 1 and 64
 * @param key optional
 * @returns
 */
export function blake2bInit(outlen: number = 64, key?: Uint8Array): Blake2bCTX {
	if (outlen <= 0 || outlen > 64) {
		outlen = 64;
	}

	// state, 'param block'
	var ctx = {
		b: new Uint8Array(128),
		h: new Uint32Array(16),
		t: 0, // input count
		c: 0, // pointer within buffer
		outlen: outlen, // output length in bytes
	};

	// initialize hash state
	for (var i = 0; i < 16; i++) {
		ctx.h[i] = BLAKE2B_IV32[i];
	}
	var keylen = key ? key.length : 0;
	ctx.h[0] ^= 0x01010000 ^ (keylen << 8) ^ outlen;

	// key the hash, if applicable
	if (key) {
		blake2bUpdate(ctx, key);
		// at the end
		ctx.c = 128;
	}

	return ctx;
}

/**
 * Updates a Blake2b streaming hash
 * @param ctx hashing context from blake2bInit()
 * @param input Byte array
 */
export function blake2bUpdate(ctx: Blake2bCTX, input: ArrayLike<number>) {
	for (var i = 0; i < input.length; i++) {
		if (ctx.c === 128) {
			// buffer full ?
			ctx.t += ctx.c; // add counters
			blake2bCompress(ctx, false); // compress (not last)
			ctx.c = 0; // counter to zero
		}
		ctx.b[ctx.c++] = input[i];
	}
}

/**
 * Completes a Blake2b streaming hash
 * @param ctx hashing context from blake2bInit()
 * @returns the final hash
 */
export function blake2bFinal(ctx: Blake2bCTX): Uint8Array {
	ctx.t += ctx.c; // mark last block offset

	while (ctx.c < 128) {
		// fill up with zeros
		ctx.b[ctx.c++] = 0;
	}
	blake2bCompress(ctx, true); // final block flag = 1

	// little endian convert and store
	var out = new Uint8Array(ctx.outlen);
	for (var i = 0; i < ctx.outlen; i++) {
		out[i] = ctx.h[i >> 2] >> (8 * (i & 3));
	}
	return out;
}

/**
 *
 * @param input the input bytes, as a string, Buffer, or Uint8Array
 * @param key optional key Uint8Array, up to 64 bytes
 * @param outlen optional output length in bytes, defaults to 64
 * @returns an n-byte Uint8Array
 */
export function blake2b(
	input: Hashable,
	key?: Uint8Array,
	outlen: number = 64
) {
	// preprocess inputs
	outlen = outlen || 64;

	// do the math
	var ctx = blake2bInit(outlen, key);
	blake2bUpdate(ctx, normalizeInput(input));
	return blake2bFinal(ctx);
}

/**
 * Computes the Blake2b hash of a string or byte array
 *
 * @param input the input bytes, as a string, Buffer, or Uint8Array
 * @param key optional key Uint8Array, up to 64 bytes
 * @param outlen outlen - optional output length in bytes, defaults to 64
 * @returns an n-byte hash in hex, all lowercase
 */
export function blake2bHex(
	input: Hashable,
	key?: Uint8Array,
	outlen: number = 64
) {
	var output = blake2b(input, key, outlen);
	return toHex(output);
}

/**
 *
 * @param input the input bytes, as a string, Buffer, or Uint8Array
 * @param key optional key Uint8Array, up to 32 bytes
 * @param outlen optional output length in bytes, defaults to 64
 * @returns the hash, as a bigint
 */
export function blake2bBigInt(
	input: Hashable,
	key?: Uint8Array,
	outlen?: number
) {
	var sixty_four = BigInt(64);
	var output = blake2b(input, key, outlen);
	var bigIntArray = new BigUint64Array(output.buffer);
	var res = BigInt(0);
	for (const n of bigIntArray) {
		res <<= sixty_four;
		res += n;
	}
	return res;
}
