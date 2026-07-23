import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function proxy(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Access token required' }, { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return NextResponse.json({ error: 'Access token required' }, { status: 401 });
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', data.user.id);
  requestHeaders.set('x-user-email', data.user.email || '');
  requestHeaders.set('x-user-created-at', data.user.created_at);
  requestHeaders.set('x-user-token', token);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/protected/:path*', '/auth/logout'],
};
