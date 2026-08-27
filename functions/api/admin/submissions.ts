interface Env {
  TALLY_API_KEY?: string;
  ADMIN_SECRET?: string;
}

const TALLY_FORM_ID = 'aQqXGW';
const DEFAULT_TALLY_KEY = 'tly-Re3eGLMMizCPTaTjDBWjHVuMDjoJYulK';

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
        JSON.stringify({ success: false, error: 'Unauthorized: Invalid admin key' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const tallyKey = context.env.TALLY_API_KEY || DEFAULT_TALLY_KEY;

    // Fetch from Tally API
    const tallyRes = await fetch(`https://api.tally.so/forms/${TALLY_FORM_ID}/submissions`, {
      headers: {
        'Authorization': `Bearer ${tallyKey}`,
        'User-Agent': 'ChineseMusic-Admin/1.0'
      }
    });

    if (!tallyRes.ok) {
      const errText = await tallyRes.text();
      return new Response(
        JSON.stringify({ success: false, error: `Tally API Error: ${errText}` }),
        { status: tallyRes.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const tallyData = await tallyRes.json() as Record<string, any>;
    const rawSubmissions = tallyData.submissions || [];
    const questions = tallyData.questions || [];

    // Map questions to readable labels
    const questionMap: Record<string, string> = {};
    for (const q of questions) {
      if (q.fields && Array.isArray(q.fields)) {
        for (const f of q.fields) {
          questionMap[f.uuid] = q.title;
        }
      }
    }

    const formattedList = rawSubmissions.map((s: any) => {
      const answers = s.answers || [];
      const data: Record<string, any> = {
        id: s.id,
        submittedAt: s.submittedAt || s.createdAt,
        name: '',
        english_name: '',
        email: '',
        wechat: '',
        phone: '',
        city: '',
        hub: '',
        participant_type: '',
        team_name: '',
        creation_mode: '',
        categories: '',
        work_title: '',
        work_url: '',
        work_concept: '',
        is_alma_mater_award: '',
        declaration: ''
      };

      for (const ans of answers) {
        const title = questionMap[ans.fieldUuid] || '';
        const val = ans.value;
        const displayVal = Array.isArray(val) ? val.join(', ') : String(val ?? '');

        if (title.includes('姓名') || title.includes('Full Name')) data.name = displayVal;
        else if (title.includes('英文名') || title.includes('English Name')) data.english_name = displayVal;
        else if (title.includes('邮箱') || title.includes('Email')) data.email = displayVal;
        else if (title.includes('微信') || title.includes('WeChat')) data.wechat = displayVal;
        else if (title.includes('电话') || title.includes('Phone')) data.phone = displayVal;
        else if (title.includes('城市') || title.includes('City')) data.city = displayVal;
        else if (title.includes('赛区') || title.includes('Region Hub')) data.hub = displayVal;
        else if (title.includes('参赛形式') || title.includes('Participation Type')) data.participant_type = displayVal;
        else if (title.includes('团队名称') || title.includes('Team Name')) data.team_name = displayVal;
        else if (title.includes('创作形式') || title.includes('Creation Mode')) data.creation_mode = displayVal;
        else if (title.includes('赛道') || title.includes('Categories')) data.categories = displayVal;
        else if (title.includes('作品标题') || title.includes('Work Title')) data.work_title = displayVal;
        else if (title.includes('作品链接') || title.includes('Work URL')) data.work_url = displayVal;
        else if (title.includes('创作理念') || title.includes('Concept')) data.work_concept = displayVal;
        else if (title.includes('母校') || title.includes('特别奖')) data.is_alma_mater_award = displayVal;
        else if (title.includes('声明') || title.includes('Declaration')) data.declaration = displayVal;
      }

      return data;
    });

    // Check if CSV format requested
    if (url.searchParams.get('format') === 'csv') {
      const headers = [
        'Submission ID', 'Submitted At', 'Name', 'English Name', 'Email', 'WeChat', 'Phone',
        'City', 'Hub', 'Participant Type', 'Team Name', 'Creation Mode',
        'Categories', 'Work Title', 'Work URL', 'Concept', 'Alma Mater Award'
      ];

      const csvRows = [headers.join(',')];

      for (const s of formattedList) {
        const row = [
          s.id || '',
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
          s.creation_mode || '',
          s.categories || '',
          s.work_title || '',
          s.work_url || '',
          (s.work_concept || '').replace(/[\r\n]+/g, ' '),
          s.is_alma_mater_award || ''
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
        source: 'Tally Official API',
        formId: TALLY_FORM_ID,
        formUrl: `https://tally.so/r/${TALLY_FORM_ID}`,
        count: formattedList.length,
        data: formattedList
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
