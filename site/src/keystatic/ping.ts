export const GET: import('astro').APIRoute = async () => new Response('pong', {});
export const POST: import('astro').APIRoute = GET;
export const prerender = false;
