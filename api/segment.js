export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST만 허용' }), { status: 405 });
  }

  try {
    // [DEBUG] 환경변수 확인
    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
    const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID;
    console.log('[DEBUG] ENV CHECK - API_KEY:', !!RUNPOD_API_KEY, '/ ENDPOINT_ID:', !!RUNPOD_ENDPOINT_ID);

    if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_ID) {
      console.log('[DEBUG] 환경변수 미설정');
      return new Response(JSON.stringify({ error: '서버 환경변수 미설정' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // [DEBUG] body 파싱
    console.log('[DEBUG] body 파싱 시작');
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.log('[DEBUG] body 파싱 실패:', e.message);
      return new Response(JSON.stringify({ error: 'body 파싱 실패: ' + e.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const { glb, filename } = body;
    console.log('[DEBUG] glb 존재:', !!glb, '/ filename:', filename, '/ glb 길이:', glb?.length);

    if (!glb) {
      return new Response(JSON.stringify({ error: 'GLB 파일 없음' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // [DEBUG] RunPod 호출
    console.log('[DEBUG] RunPod 호출 시작');
    const runpodRes = await fetch(
      `https://api.runpod.io/v2/${RUNPOD_ENDPOINT_ID}/runsync`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RUNPOD_API_KEY}`,
        },
        body: JSON.stringify({
          input: { glb, filename: filename || 'model.glb' }
        }),
      }
    );

    console.log('[DEBUG] RunPod 응답 status:', runpodRes.status);
    const rawText = await runpodRes.text();
    console.log('[DEBUG] RunPod 응답 raw (앞 200자):', rawText.substring(0, 200));

    let result;
    try {
      result = JSON.parse(rawText);
    } catch (e) {
      return new Response(JSON.stringify({
        error: 'RunPod 응답 파싱 실패',
        raw: rawText.substring(0, 200),
        status: runpodRes.status
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (err) {
    console.log('[DEBUG] 최종 catch 에러:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
