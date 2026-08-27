interface Env {
  CHINESEMUSIC_R2?: any;
  CHINESEMUSIC_KV?: any;
  ADMIN_SECRET?: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const refId = url.searchParams.get('refId');

    if (refId) {
      // Query specific registration
      if (context.env.CHINESEMUSIC_KV) {
        const val = await context.env.CHINESEMUSIC_KV.get(`submission:${refId}`);
        if (val) {
          return new Response(val, {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      if (context.env.CHINESEMUSIC_R2) {
        const file = await context.env.CHINESEMUSIC_R2.get(`submissions/${refId}.json`);
        if (file) {
          const text = await file.text();
          return new Response(text, {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      return new Response(
        JSON.stringify({ success: false, error: 'Registration not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Health / Status check
    return new Response(
      JSON.stringify({
        status: 'online',
        service: 'ChineseMusic Registration API',
        storage: {
          hasKV: !!context.env.CHINESEMUSIC_KV,
          hasR2: !!context.env.CHINESEMUSIC_R2
        },
        time: new Date().toISOString()
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const request = context.request;
    const body = await request.json() as Record<string, any>;

    // Validate required fields
    const { name, email, city, hub, work_title, work_url, agreed } = body;
    if (!name || !email || !city || !hub || !work_title || !work_url || !agreed) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique reference ID
    const dateStr = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const randStr = Math.random().toString(36).substring(2, 7).toUpperCase();
    const refId = `CM2026-${dateStr}-${randStr}`;

    const submissionData = {
      refId,
      submittedAt: new Date().toISOString(),
      ip: request.headers.get('cf-connecting-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      ...body
    };

    // Store in R2 bucket if available
    if (context.env.CHINESEMUSIC_R2) {
      await context.env.CHINESEMUSIC_R2.put(
        `submissions/${refId}.json`,
        JSON.stringify(submissionData, null, 2),
        {
          customMetadata: {
            name: String(name),
            email: String(email),
            hub: String(hub),
            work_title: String(work_title)
          }
        }
      );
    }

    // Store in KV if available
    if (context.env.CHINESEMUSIC_KV) {
      await context.env.CHINESEMUSIC_KV.put(
        `submission:${refId}`,
        JSON.stringify(submissionData)
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        refId,
        message: 'Registration received successfully'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
