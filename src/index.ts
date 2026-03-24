/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import type { Env } from './db/schema';

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		// Test D1 connection after schema
		try {
			const { results } = await env.DATABASE.prepare('SELECT name FROM sqlite_master WHERE type=\\\'table\\\';').all();
			const tables = results.map((r: any) => r.name);
			return new Response(JSON.stringify({ status: 'D1 connected', tables }), {
				headers: { 'Content-Type': 'application/json' }
			});
		} catch (e: any) {
			return new Response(`DB Error: ${e.message}`, { status: 500 });
		}
	},
} satisfies ExportedHandler<Env>;
