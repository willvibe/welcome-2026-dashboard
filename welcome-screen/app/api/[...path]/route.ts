// Same-origin streaming proxy for the production Node server. The API binds to loopback only.
async function proxy(request: Request) {
  const url = new URL(request.url);
  const headers = new Headers(request.headers);
  headers.set('x-welcome-original-host', url.host);
  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');
  try {
    const response = await fetch(
      `http://127.0.0.1:${process.env.API_PORT || 3001}${url.pathname}${url.search}`,
      {
        method: request.method,
        headers,
        body: ['GET', 'HEAD'].includes(request.method)
          ? undefined
          : await request.text(),
        signal: request.signal,
      },
    );
    const outgoing = new Headers(response.headers);
    outgoing.delete('transfer-encoding');
    outgoing.delete('connection');
    return new Response(response.body, {
      status: response.status,
      headers: outgoing,
    });
  } catch {
    return Response.json(
      { error: '报到服务未启动，请运行项目启动脚本' },
      { status: 503 },
    );
  }
}
export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
