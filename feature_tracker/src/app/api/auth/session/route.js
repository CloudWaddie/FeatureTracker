import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    console.log('Session API request received');
    
    // Parse the request body
    const requestData = await request.json();
    const { event, session, timestamp } = requestData;
    
    console.log(`Session API: ${event} event at ${timestamp}`);
    
    // Extract the authorization token if present
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if (!session) {
      console.log('No session provided in request');
      return NextResponse.json({ success: false, message: 'No session provided' }, { status: 400 });
    }
    
    // Create a new cookie store
    const cookieStore = cookies();
    
    // Get supabase server client
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Validate and establish the session on the server side
    console.log(`Setting session for user: ${session.user.id}`);
    console.log(`Access token length: ${session.access_token.length}`);
    console.log(`Refresh token length: ${session.refresh_token.length}`);
    
    // Set the session explicitly
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    });
    
    if (sessionError) {
      console.error('Error setting session:', sessionError);
      return NextResponse.json({ 
        success: false, 
        message: 'Failed to set session',
        error: sessionError.message 
      }, { status: 500 });
    }
    
    // Explicitly set auth cookies with proper attributes
    const response = NextResponse.json({ 
      success: true, 
      message: 'Session established successfully',
      timestamp: new Date().toISOString()
    });
    
    // Return success response
    return response;
  } catch (error) {
    console.error('Session API error:', error.message);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error',
      error: error.message 
    }, { status: 500 });
  }
}

// Add OPTIONS method to handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
