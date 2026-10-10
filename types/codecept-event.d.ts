declare module "codeceptjs/lib/event" {
	import type { EventEmitter } from "node:events";
	const event: {
		dispatcher: EventEmitter;
		test: {
			started: string;
			passed: string;
			failed: string;
			skipped: string;
			finished: string;
		};
		all: { before: string; result: string };
	};
	export default event;
}
