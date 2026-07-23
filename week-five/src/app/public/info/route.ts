import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { message: 'Welcome stranger! This info is public.' },
    { status: 200 }
  );
}
