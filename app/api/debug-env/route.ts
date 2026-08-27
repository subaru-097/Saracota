import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;

  return NextResponse.json({
    hasApiKey: !!apiKey,
    apiKeyLast4: apiKey ? apiKey.slice(-4) : null,
    hasProjectId: !!projectId,
    projectIdValue: projectId || null,
    environment: process.env.NODE_ENV || 'unknown',
    vercelEnv: process.env.VERCEL_ENV || 'unknown',
  });
}
