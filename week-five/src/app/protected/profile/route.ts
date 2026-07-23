import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

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

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return NextResponse.json(
      { error: 'Invalid or expired token' },
      { status: 401 }
    );
  }

  return NextResponse.json(
    {
      id: data.user.id,
      email: data.user.email,
      created_at: data.user.created_at,
    },
    { status: 200 }
  );
}
