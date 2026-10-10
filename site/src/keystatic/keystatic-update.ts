import { createRequire } from 'node:module';
import keystaticConfig from '../../keystatic.config';

const require2 = createRequire(import.meta.url);
const { makeGenericAPIRouteHandler } = require2(
  'C:/Yandex.Disk/DesignStudio/site/node_modules/@keystatic/core/dist/keystatic-core-api-generic.node.js'
);
const handler = makeGenericAPIRouteHandler({ config: keystaticConfig }, { slugEnvName: 'PUBLIC_KEYSTATIC_GITHUB_APP_SLUG' });

export const POST: import('astro').APIRoute = async (ctx) => {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
  const url = new URL(ctx.request.url);
  const path = url.pathname.startsWith(base + '/') ? url.pathname.slice(base.length) : url.pathname;
  const raw = await ctx.request.arrayBuffer();
  const rewritten = new Request(new URL(path + url.search, url.origin), {
    method: 'POST',
    headers: ctx.request.headers,
    body: raw,
  });
  const { body, headers, status } = await handler(rewritten);
  return new Response(body, { status, headers });
};
export const prerender = false;
