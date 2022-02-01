type TypedArray =
	| Int8Array
	| Uint8Array
	| Uint8ClampedArray
	| Int16Array
	| Uint16Array
	| Int32Array
	| Uint32Array
	| Float32Array
	| Float64Array
	| BigInt64Array
	| BigUint64Array
	| { buffer: ArrayBuffer };

export type Hashable =
	| keyof any
	| string
	| Buffer
	| TypedArray
	| Set<Hashable>
	| Map<Hashable, Hashable>
	| Hashable[]
	| {
			[index: string | number]: Hashable;
	  };

export function normalizeInput(
	input: Hashable,
	stack?: Hashable[],
	decorator?: string
): Uint8Array {
	if (typeof input !== 'object') {
		return Buffer.from(String(input?.toString?.() || input));
	} else if (input instanceof Uint8Array) {
		return input;
	} else if ('buffer' in input && input.buffer instanceof ArrayBuffer) {
		return new Uint8Array(input.buffer);
	} else {
		const new_stack = stack ? [...stack, input] : [input];
		if (input instanceof Array) {
			const ar = Array<Uint8Array | string>(
				`(${decorator || input.length})[`
			);
			for (let i = 0; i < input.length; ++i) {
				if (!new_stack.includes(input[i])) {
					i && ar.push(',');
					ar.push(normalizeInput(input[i]));
				}
			}
			ar.push(']');
			return Buffer.concat(ar.map(Buffer.from));
		} else if (input instanceof Set) {
			return normalizeInput([...input], new_stack, 'SET');
		} else if (input instanceof Map) {
			return normalizeInput([...input.entries()], new_stack, 'MAP');
		} else {
			return normalizeInput(Object.entries(input), new_stack, 'OBJ');
		}
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
		console.log(
			'Hashed in ' + ms + 'ms: ' + hashHex.substring(0, 20) + '...'
		);
		console.log(
			Math.round((N / (1 << 20) / (ms / 1000)) * 100) / 100 +
				' MB PER SECOND'
		);
	}
}
