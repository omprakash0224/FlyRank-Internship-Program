import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const id = request.headers.get('x-user-id');
  const email = request.headers.get('x-user-email');
  const created_at = request.headers.get('x-user-created-at');

  return NextResponse.json(
    { id, email, created_at },
    { status: 200 }
  );
}
