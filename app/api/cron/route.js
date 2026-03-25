export const maxDuration = 300;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Call the generate-brief endpoint
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3000';
  
  try {
    const res = await fetch(`${baseUrl}/api/generate-brief?secret=${secret}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await res.json();
    return Response.json({ triggered: true, result: data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
