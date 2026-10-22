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

    // Fetch from Tally API (limit=500 covers all submissions)
    const tallyRes = await fetch(`https://api.tally.so/forms/${TALLY_FORM_ID}/submissions?limit=500`, {
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
      questionMap[q.id] = q.title;
      if (q.fields && Array.isArray(q.fields)) {
        for (const f of q.fields) {
          questionMap[f.uuid] = q.title;
        }
      }
    }

    const formattedList = rawSubmissions.map((s: any) => {
      const answers = s.responses || s.answers || [];
      const primaryWorks = [
        { index: 1, title: '', url: '' },
        { index: 2, title: '', url: '' },
        { index: 3, title: '', url: '' },
        { index: 4, title: '', url: '' },
        { index: 5, title: '', url: '' },
        { index: 6, title: '', url: '' },
        { index: 7, title: '', url: '' },
        { index: 8, title: '', url: '' },
      ];
      const backupWorks = [
        { index: 1, title: '', url: '' },
        { index: 2, title: '', url: '' },
      ];

      const data: Record<string, any> = {
        id: s.id,
        refId: s.id,
        submittedAt: s.submittedAt || s.createdAt,
        name: '',
        english_name: '',
        email: '',
        wechat: '',
        phone: '',
        city: '',
        hub: '',
        participant_type: '',
        raw_participant_type: '',
        team_name: '',
        creation_mode: 'ai_aided',
        raw_creation_mode: '',
        categories: '',
        work_title: '',
        work_url: '',
        primary_works: primaryWorks,
        backup_works: backupWorks,
        total_works: 0,
        work_concept: '',
        is_alma_mater_award: 'no',
        is_zju_affiliated: 'no',
        raw_alma_mater_award: '',
        declaration: ''
      };

      for (const ans of answers) {
        const title = questionMap[ans.questionId] || questionMap[ans.fieldUuid] || '';
        const val = ans.answer !== undefined ? ans.answer : ans.value;
        const displayVal = (Array.isArray(val) ? val.join(', ') : String(val ?? '')).trim();
        if (!displayVal) continue;

        if (title.includes('姓名') || title.includes('Full Name')) data.name = displayVal;
        else if (title.includes('英文名') || title.includes('暱稱') || title.includes('English Name')) data.english_name = displayVal;
        else if (title.includes('邮箱') || title.includes('郵箱') || title.includes('Email')) data.email = displayVal;
        else if (title.includes('微信') || title.includes('微訊') || title.includes('WeChat')) data.wechat = displayVal;
        else if (title.includes('电话') || title.includes('電話') || title.includes('Phone')) data.phone = displayVal;
        else if (title.includes('城市') || title.includes('City') || title.includes('Residence')) data.city = displayVal;
        else if (title.includes('赛区') || title.includes('賽區') || title.includes('Region Hub') || title.includes('Track & Regional Hub') || title.includes('赛道') || title.includes('賽道')) data.hub = displayVal;
        else if (title.includes('参赛形式') || title.includes('參賽形式') || title.includes('Participation Type')) {
          data.raw_participant_type = displayVal;
          data.participant_type = (displayVal.includes('团队') || displayVal.includes('團隊') || displayVal.includes('Team')) ? 'team' : 'individual';
        }
        else if (title.includes('团队名称') || title.includes('團隊名稱') || title.includes('Team Name')) data.team_name = displayVal;
        else if (title.includes('创作形式') || title.includes('創作形式') || title.includes('Creation Mode')) {
          data.raw_creation_mode = displayVal;
          if (displayVal.includes('纯原') || displayVal.includes('純原') || displayVal.includes('No AI') || displayVal.includes('Zero AI')) {
            data.creation_mode = 'no_ai';
          } else if (displayVal.includes('全流程') || displayVal.includes('AIGC') || displayVal.includes('Full-Pipeline')) {
            data.creation_mode = 'aigc';
          } else {
            data.creation_mode = 'ai_aided';
          }
        }
        else if (title.includes('专业方向') || title.includes('專業方向') || title.includes('Categories') || title.includes('Disciplines') || title.includes('申报赛道方向')) data.categories = displayVal;
        // Work 1 (Primary / Legacy compatible)
        else if (
          title.includes('主選作品 1 標題') || title.includes('主选作品 1 标题') || title.includes('Primary Song 1 Title') ||
          ((title.includes('作品標題') || title.includes('作品标题') || title.includes('Work Title')) && !title.includes('主選作品') && !title.includes('主选作品') && !title.includes('備選') && !title.includes('备选'))
        ) {
          primaryWorks[0].title = displayVal;
          data.work_title = displayVal;
        }
        else if (
          title.includes('主選作品 1 試聽') || title.includes('主选作品 1 链接') || title.includes('Primary Song 1 URL') ||
          ((title.includes('試聽') || title.includes('试听') || title.includes('作品链接') || title.includes('Work URL')) && !title.includes('主選作品') && !title.includes('主选作品') && !title.includes('備選') && !title.includes('备选'))
        ) {
          primaryWorks[0].url = displayVal;
          data.work_url = displayVal;
        }
        // Works 2 to 8
        else if (title.includes('主選作品') || title.includes('主选作品') || title.includes('Primary Song')) {
          for (let k = 2; k <= 8; k++) {
            if (title.includes(`主選作品 ${k}`) || title.includes(`主选作品 ${k}`) || title.includes(`Primary Song ${k}`)) {
              if (title.includes('標題') || title.includes('标题') || title.includes('Title')) {
                primaryWorks[k - 1].title = displayVal;
              } else if (title.includes('試聽') || title.includes('试听') || title.includes('鏈接') || title.includes('链接') || title.includes('URL')) {
                primaryWorks[k - 1].url = displayVal;
              }
              break;
            }
          }
        }
        // Backup Works 1 and 2
        else if (title.includes('備選作品') || title.includes('备选作品') || title.includes('Backup Song')) {
          for (let m = 1; m <= 2; m++) {
            if (title.includes(`備選作品 ${m}`) || title.includes(`备选作品 ${m}`) || title.includes(`Backup Song ${m}`)) {
              if (title.includes('標題') || title.includes('标题') || title.includes('Title')) {
                backupWorks[m - 1].title = displayVal;
              } else if (title.includes('試聽') || title.includes('试听') || title.includes('鏈接') || title.includes('链接') || title.includes('URL')) {
                backupWorks[m - 1].url = displayVal;
              }
              break;
            }
          }
        }
        else if (title.includes('创作理念') || title.includes('創作理念') || title.includes('Concept')) data.work_concept = displayVal;
        else if (title.includes('母校') || title.includes('特别奖') || title.includes('特別獎') || title.includes('Tribute')) {
          data.raw_alma_mater_award = displayVal;
          const isYes = displayVal.includes('是') || displayVal.includes('Yes');
          data.is_alma_mater_award = isYes ? 'yes' : 'no';
          data.is_zju_affiliated = isYes ? 'yes' : 'no';
        }
        else if (title.includes('声明') || title.includes('聲明') || title.includes('Declaration')) data.declaration = displayVal;
      }

      const activePrimary = primaryWorks.filter(w => w.title || w.url);
      const activeBackup = backupWorks.filter(w => w.title || w.url);
      data.total_works = activePrimary.length + activeBackup.length;
      if (!data.work_title && activePrimary[0]?.title) data.work_title = activePrimary[0].title;
      if (!data.work_url && activePrimary[0]?.url) data.work_url = activePrimary[0].url;

      // Smart ZJU Special Award Classification
      const allText = [
        data.work_concept,
        ...primaryWorks.map(w => w.title),
        ...backupWorks.map(w => w.title)
      ].join(' ');
      
      const isCoreZju = /钱塘|之江|玉泉|紫金港|求是园|求是/i.test(allText);
      const isBroadZju = /归航|潮向未来/i.test(allText);

      if (data.is_alma_mater_award === 'yes') {
        if (isCoreZju) {
          data.zju_award_tier = 'core';
        } else if (isBroadZju) {
          data.zju_award_tier = 'broad';
        } else {
          data.zju_award_tier = 'general';
        }
      } else {
        data.zju_award_tier = 'none';
      }

      return data;
    });

    // Check if CSV format requested
    if (url.searchParams.get('format') === 'csv') {
      const headers = [
        'Submission ID', 'Submitted At', 'Name', 'English Name', 'Email', 'WeChat', 'Phone',
        'City', 'Hub', 'Participant Type', 'Team Name', 'Creation Mode',
        'Categories', 'Total Works',
        'Work 1 Title', 'Work 1 URL',
        'Work 2 Title', 'Work 2 URL',
        'Work 3 Title', 'Work 3 URL',
        'Work 4 Title', 'Work 4 URL',
        'Work 5 Title', 'Work 5 URL',
        'Work 6 Title', 'Work 6 URL',
        'Work 7 Title', 'Work 7 URL',
        'Work 8 Title', 'Work 8 URL',
        'Backup 1 Title', 'Backup 1 URL',
        'Backup 2 Title', 'Backup 2 URL',
        'Concept', 'Alma Mater Award'
      ];

      const csvRows = [headers.join(',')];

      for (const s of formattedList) {
        const pWorks = s.primary_works || [];
        const bWorks = s.backup_works || [];

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
          s.raw_creation_mode || s.creation_mode || '',
          s.categories || '',
          s.total_works || (s.work_title ? 1 : 0),
          pWorks[0]?.title || s.work_title || '',
          pWorks[0]?.url || s.work_url || '',
          pWorks[1]?.title || '',
          pWorks[1]?.url || '',
          pWorks[2]?.title || '',
          pWorks[2]?.url || '',
          pWorks[3]?.title || '',
          pWorks[3]?.url || '',
          pWorks[4]?.title || '',
          pWorks[4]?.url || '',
          pWorks[5]?.title || '',
          pWorks[5]?.url || '',
          pWorks[6]?.title || '',
          pWorks[6]?.url || '',
          pWorks[7]?.title || '',
          pWorks[7]?.url || '',
          bWorks[0]?.title || '',
          bWorks[0]?.url || '',
          bWorks[1]?.title || '',
          bWorks[1]?.url || '',
          (s.work_concept || '').replace(/[\r\n]+/g, ' '),
          s.raw_alma_mater_award || s.is_alma_mater_award || ''
        ].map(val => `"${String(val).replace(/"/g, '""')}"`);

        csvRows.push(row.join(','));
      }

      return new Response('\uFEFF' + csvRows.join('\n'), {
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
