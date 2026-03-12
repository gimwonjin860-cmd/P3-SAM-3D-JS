export const config = {
  runtime: 'edge',
};

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  const url = new URL(req.url);

  // 상태 폴링: GET /api/segment?jobId=xxx
  if (req.method === 'GET') {
    const jobId = url.searchParams.get('jobId');
    if (!jobId) {
      return new Response(JSON.stringify({ error: 'jobId 없음' }), { status: 400, headers: CORS });
    }
    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
    const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID;
    const statusRes = await fetch(
      `https://api.runpod.io/v2/${RUNPOD_ENDPOINT_ID}/status/${jobId}`,
      { headers: { 'Authorization': `Bearer ${RUNPOD_API_KEY}` } }
    );
    const data = await statusRes.json();
    return new Response(JSON.stringify(data), { status: 200, headers: CORS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST만 허용' }), { status: 405, headers: CORS });
  }

  try {
    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
    const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID;

    if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_ID) {
      return new Response(JSON.stringify({ error: '서버 환경변수 미설정' }), { status: 500, headers: CORS });
    }

    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'body 파싱 실패: ' + e.message }), { status: 400, headers: CORS });
    }

    const { glb, filename } = body;
    if (!glb) {
      return new Response(JSON.stringify({ error: 'GLB 파일 없음' }), { status: 400, headers: CORS });
    }

    const runRes = await fetch(
      `https://api.runpod.io/v2/${RUNPOD_ENDPOINT_ID}/run`,
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

    const runData = await runRes.json();

    // jobId 없으면 RunPod 전체 응답 반환 (디버그)
    if (!runData.id) {
      return new Response(JSON.stringify({ error: 'jobId 없음', raw: runData, httpStatus: runRes.status }), {
        status: 200,
        headers: CORS,
      });
    }

    return new Response(JSON.stringify({ jobId: runData.id, status: runData.status }), {
      status: 200,
      headers: CORS,
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
}
