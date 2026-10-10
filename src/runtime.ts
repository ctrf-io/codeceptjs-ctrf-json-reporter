/** Metadata is scoped to the test currently executing in this worker process. */
const key = Symbol.for("ctrf.codeceptjs.runtime");
type Processor = (data: Record<string, unknown>) => void;
type RuntimeGlobal = typeof globalThis & { [key]?: Processor };

export function setRuntime(processor?: Processor): void {
	if (processor) (globalThis as RuntimeGlobal)[key] = processor;
	else delete (globalThis as RuntimeGlobal)[key];
}

/** Attach metadata to the current test; calls outside a running test are ignored. */
export function extra(data: Record<string, unknown>): void {
	(globalThis as RuntimeGlobal)[key]?.(data);
}

export const ctrf = { extra };

/** Recursively merge objects and concatenate arrays, excluding unsafe object keys. */
export function mergeExtra(
	target: Record<string, unknown>,
	data: Record<string, unknown>,
): Record<string, unknown> {
	for (const [name, value] of Object.entries(data)) {
		if (["__proto__", "constructor", "prototype"].includes(name)) continue;
		const old = target[name];
		if (Array.isArray(value)) {
			target[name] = [...(Array.isArray(old) ? old : []), ...value];
		} else if (value && typeof value === "object") {
			target[name] = mergeExtra(
				old && typeof old === "object" && !Array.isArray(old)
					? (old as Record<string, unknown>)
					: {},
				value as Record<string, unknown>,
			);
		} else target[name] = value;
	}
	return target;
}
