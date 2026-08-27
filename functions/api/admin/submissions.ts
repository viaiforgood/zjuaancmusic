interface Env {
  CHINESEMUSIC_R2?: any;
  CHINESEMUSIC_KV?: any;
  ADMIN_SECRET?: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const keyParam = url.searchParams.get('key') || url.searchParams.get('admin_key');
    const authHeader = context.request.headers.get('Authorization');
    const bearerKey = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    const validSecret = context.env.ADMIN_SECRET || 'cm2026admin';
    const providedKey = keyParam || bearerKey;

    if (!providedKey || providedKey !== validSecret) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: Invalid or missing admin key' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const submissions: any[] = [];
    let source = 'none';

    // 1. Try reading from KV
    if (context.env.CHINESEMUSIC_KV) {
      source = 'KV';
      const list = await context.env.CHINESEMUSIC_KV.list({ prefix: 'submission:' });
      for (const key of list.keys) {
        const val = await context.env.CHINESEMUSIC_KV.get(key.name);
        if (val) {
          try {
            submissions.push(JSON.parse(val));
          } catch (e) {
            submissions.push({ key: key.name, raw: val });
          }
        }
      }
    } 
    // 2. Try reading from R2 if KV empty or unavailable
    else if (context.env.CHINESEMUSIC_R2) {
      source = 'R2';
      const list = await context.env.CHINESEMUSIC_R2.list({ prefix: 'submissions/' });
      for (const obj of list.objects) {
        const file = await context.env.CHINESEMUSIC_R2.get(obj.key);
        if (file) {
          const text = await file.text();
          try {
            submissions.push(JSON.parse(text));
          } catch (e) {
            submissions.push({ key: obj.key, raw: text });
          }
        }
      }
    }

    // Sort by submittedAt descending (newest first)
    submissions.sort((a, b) => {
      const dateA = new Date(a.submittedAt || 0).getTime();
      const dateB = new Date(b.submittedAt || 0).getTime();
      return dateB - dateA;
    });

    // Check if CSV format requested
    if (url.searchParams.get('format') === 'csv') {
      const headers = [
        'Ref ID', 'Submitted At', 'Name', 'English Name', 'Email', 'WeChat', 'Phone',
        'City', 'Hub', 'Participant Type', 'Team Name', 'ZJU Affiliated', 'Creation Mode',
        'Categories', 'Work Title', 'Work URL', 'Concept', 'Alma Mater Award', 'Notes'
      ];

      const csvRows = [headers.join(',')];

      for (const s of submissions) {
        const row = [
          s.refId || '',
          s.submittedAt || '',
          s.name || '',
          s.english_name || '',
          s.email || '',
          s.wechat || '',
          s.phone || '',
          s.city || '',
          s.hub || '',
          s.participant_type || '',
          s.team_name || '',
          s.is_zju_affiliated || '',
          s.creation_mode || '',
          Array.isArray(s.categories) ? s.categories.join(';') : (s.categories || ''),
          s.work_title || '',
          s.work_url || '',
          (s.work_concept || '').replace(/[\r\n]+/g, ' '),
          s.is_alma_mater_award || '',
          (s.notes || '').replace(/[\r\n]+/g, ' ')
        ].map(val => `"${String(val).replace(/"/g, '""')}"`);

        csvRows.push(row.join(','));
      }

      return new Response(csvRows.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="chinesemusic_submissions_${new Date().toISOString().slice(0, 10)}.csv"`
        }
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: submissions.length,
        source,
        storageConfig: {
          hasKV: !!context.env.CHINESEMUSIC_KV,
          hasR2: !!context.env.CHINESEMUSIC_R2
        },
        data: submissions
      }, null, 2),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
