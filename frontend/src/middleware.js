import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';

export async function middleware(req) {
  try {
    // Log request info with clear separation
    console.log('\n=== MIDDLEWARE EXECUTION START ===');
    console.log(`Request URL: ${req.url}`);
    console.log(`Pathname: ${req.nextUrl.pathname}`);
    
    const path = req.nextUrl.pathname;
    
    // Create response object that will be modified with auth cookies
    const res = NextResponse.next();
    
    // Debug cookies present in the request
    const cookiesList = Object.entries(req.cookies || {})
      .map(([name, value]) => `${name}: ${value.length > 20 ? value.substring(0, 20) + '...' : value}`);
    console.log('Request cookies:', cookiesList.length ? cookiesList : 'None');
    
    // Create the Supabase client for auth checks
    const supabase = createMiddlewareClient({ req, res }, {
      supabaseUrl: 'https://mccbekclrcnckrzfdoza.supabase.co',
      supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jY2Jla2NscmNuY2tyemZkb3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxNDczNDAsImV4cCI6MjA1ODcyMzM0MH0.7HSl_zdjOrfcQFLFYFES-t0KGaK2zRAnt1MDP3_Dpqk'
    });
    
    // Get session and forcefully refresh it
    const sessionResult = await supabase.auth.getSession();
    console.log('Session query result:', {
      hasData: !!sessionResult.data,
      hasSession: !!sessionResult.data?.session,
      error: sessionResult.error ? sessionResult.error.message : null,
    });
    
    const session = sessionResult.data?.session;
    
    // Public routes that don't require authentication
    const publicRoutes = [
      '/auth/signin', 
      '/auth/signup', 
      '/auth/reset-password', 
      '/auth/update-password'
    ];
    
    const isPublicRoute = publicRoutes.some(route => 
      path === route || 
      (route.endsWith('*') && path.startsWith(route.slice(0, -1)))
    );
    
    console.log(`Route "${path}" is ${isPublicRoute ? 'public' : 'protected'}`);
    
    // Response needs to include the auth cookies regardless
    const response = NextResponse.next({
      request: {
        headers: req.headers,
      },
    });
    
    // Copy set-cookie headers from middleware response to final response
    const setCookieHeader = res.headers.get('set-cookie');
    if (setCookieHeader) {
      console.log('Set-Cookie header present - copying to response');
      response.headers.set('set-cookie', setCookieHeader);
    }
    
    // Check if user is authenticated
    if (session) {
      console.log(`User authenticated: ${session.user.email}`);
      
      // If user is on an auth route (like signin), redirect to dashboard
      if (path.startsWith('/auth/') && !path.includes('update-password')) {
        console.log('Redirecting authenticated user to dashboard');
        const redirectUrl = new URL('/dashboard', req.url);
        const redirectResponse = NextResponse.redirect(redirectUrl);
        
        // Copy auth cookies to redirect response
        if (setCookieHeader) {
          redirectResponse.headers.set('set-cookie', setCookieHeader);
        }
        
        return redirectResponse;
      }
      
      // User is authenticated and accessing a valid route
      console.log('Authenticated access granted');
      return response;
    } else {
      console.log('No active session found');
      
      // If trying to access a protected route, redirect to login
      if (!isPublicRoute) {
        console.log(`Redirecting to signin from ${path}`);
        const redirectUrl = new URL('/auth/signin', req.url);
        
        // Save the original URL to redirect back after login
        if (path !== '/') {
          redirectUrl.searchParams.set('redirectedFrom', path);
        }
        
        return NextResponse.redirect(redirectUrl);
      }
      
      // Accessing public route while not authenticated is fine
      console.log('Allowing public route access');
      return response;
    }
  } catch (error) {
    console.error('Middleware error:', error);
    // In case of error, log it but still allow the request to proceed
    return NextResponse.next();
  } finally {
    console.log('=== MIDDLEWARE EXECUTION END ===\n');
  }
}

// Update the matcher to handle all routes
export const config = {
  matcher: [
    '/',               // Root path
    '/dashboard/:path*',  // Dashboard and sub-routes
    '/profile/:path*',    // Profile and sub-routes
    '/auth/:path*',       // Auth pages
    '/features/:path*',   // Feature pages
    '/api/:path*',        // API routes (for completeness)
  ]
};
