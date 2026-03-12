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
    const body = await req.json();
    const { glb, filename } = body;

    if (!glb) {
      return new Response(JSON.stringify({ error: 'GLB 파일 없음' }), { status: 400 });
    }

    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
    const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID;

    if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_ID) {
      return new Response(JSON.stringify({ error: '서버 환경변수 미설정' }), { status: 500 });
    }

    // RunPod Serverless 요청
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

    // 응답 텍스트로 먼저 받기
    const rawText = await runpodRes.text();
    
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
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
