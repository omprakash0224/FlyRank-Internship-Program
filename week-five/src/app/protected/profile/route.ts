import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Access token required' },
      { status: 401 }
    );
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return NextResponse.json(
      { error: 'Access token required' },
      { status: 401 }
    );
  }

  // Placeholder for Stage 2. Stage 3 will implement token verification.
  return NextResponse.json(
    { message: 'Token successfully extracted (unverified)' },
    { status: 200 }
  );
}
