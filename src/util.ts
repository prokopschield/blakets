import { encode } from 'doge-json/lib/normalize-and-encode';

const ERROR_MSG_INPUT = 'Input must be an string, Buffer or Uint8Array';

// For convenience, let people hash a string, not just a Uint8Array
export function normalizeInput(
	input: string | { buffer: ArrayBuffer }
): Uint8Array {
	if (typeof input !== 'object') {
		return new Uint8Array(Buffer.from(`${input}`));
	} else if ('buffer' in input) {
		if (input instanceof Uint8Array) return input;
		else return new Uint8Array(input.buffer);
	} else {
		return normalizeInput(encode(input));
	}
}

// Converts a Uint8Array to a hexadecimal string
// For example, toHex([255, 0, 255]) returns "ff00ff"
export function toHex(bytes: ArrayLike<number>): string {
	return Array.prototype.map
		.call(bytes, function (n: number) {
			return (n < 16 ? '0' : '') + n.toString(16);
		})
		.join('');
}

// Converts any value in [0...2^32-1] to an 8-character hex string
export function uint32ToHex(val: number): string {
	return (0x100000000 + val).toString(16).substring(1);
}

// For debugging: prints out hash state in the same format as the RFC
// sample computation exactly, so that you can diff
export function debugPrint(
	label: string,
	arr: ArrayLike<number>,
	size: number
) {
	var msg = '\n' + label + ' = ';
	for (var i = 0; i < arr.length; i += 2) {
		if (size === 32) {
			msg += uint32ToHex(arr[i]).toUpperCase();
			msg += ' ';
			msg += uint32ToHex(arr[i + 1]).toUpperCase();
		} else if (size === 64) {
			msg += uint32ToHex(arr[i + 1]).toUpperCase();
			msg += uint32ToHex(arr[i]).toUpperCase();
		} else throw new Error('Invalid size ' + size);
		if (i % 6 === 4) {
			msg += '\n' + new Array(label.length + 4).join(' ');
		} else if (i < arr.length - 2) {
			msg += ' ';
		}
	}
	console.log(msg);
}

// For performance testing: generates N bytes of input, hashes M times
// Measures and prints MB/second hash performance each time
export function testSpeed(hashFn: Function, N: number, M: number) {
	var startMs = new Date().getTime();

	var input = new Uint8Array(N);
	for (var i = 0; i < N; i++) {
		input[i] = i % 256;
	}
	var genMs = new Date().getTime();
	console.log('Generated random input in ' + (genMs - startMs) + 'ms');
	startMs = genMs;

	for (i = 0; i < M; i++) {
		var hashHex = hashFn(input);
		var hashMs = new Date().getTime();
		var ms = hashMs - startMs;
		startMs = hashMs;
		console.log('Hashed in ' + ms + 'ms: ' + hashHex.substring(0, 20) + '...');
		console.log(
			Math.round((N / (1 << 20) / (ms / 1000)) * 100) / 100 + ' MB PER SECOND'
		);
	}
}
