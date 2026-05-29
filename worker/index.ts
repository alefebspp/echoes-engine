export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Response.json({
        status: 'ok',
        environment: env.ENVIRONMENT,
      });
    }

    return Response.json({ error: 'Not Found' }, { status: 404 });
  },
};

interface Env {
  ENVIRONMENT: string;
}
