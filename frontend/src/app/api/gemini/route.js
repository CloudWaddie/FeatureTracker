import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request) {
  const { diff, query, fileName, version1Id, version2Id } = await request.json();
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    // 1. Get user session and profile data (including API key)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error('Error getting session or no session:', sessionError);
      return NextResponse.json({ error: 'Unauthorized: No active session' }, { status: 401 });
    }

    const userId = session.user.id;

    // Check if a summary already exists for this combination
    const { data: existingSummary, error: existingError } = await supabase
      .from('diff_summaries')
      .select('summary, model_used')
      .eq('user_id', userId)
      .eq('file_name', fileName)
      .eq('version1_id', version1Id)
      .eq('version2_id', version2Id)
      .maybeSingle(); // Use maybeSingle to handle 0 or 1 result without error

    if (existingError) {
      console.error('Error checking for existing summary:', existingError);
      // Proceed to generate a new one, but log the error
    }

    if (existingSummary) {
      console.log('Returning existing summary from DB');
      return NextResponse.json({
        summary: existingSummary.summary,
        message: `Retrieved existing summary (Model: ${existingSummary.model_used || 'Unknown'})`
      });
    }

    // --- No existing summary found, proceed to generate ---

    // Fetch user profile to get the Gemini API key
    const { data: profile, error: profileError } = await supabase
      .from('profiles') // Assuming you have a 'profiles' table
      .select('gemini_api_key') // Assuming the column is named 'gemini_api_key'
      .eq('id', userId)
      .single();

    if (profileError || !profile || !profile.gemini_api_key) {
      console.error('Error fetching profile or API key missing:', profileError);
      return NextResponse.json({ error: 'Gemini API key not configured in profile.' }, { status: 400 });
    }

    const geminiApiKey = profile.gemini_api_key;

    // 2. Initialize Google Generative AI
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // 3. Construct the prompt
    const prompt = `${query}\n\nFile Diff:\n\`\`\`diff\n${diff}\n\`\`\``;

    // 4. Call Gemini API
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text();

    if (!summary) {
      throw new Error('Gemini did not return a summary.');
    }

    // 5. Save summary to Supabase
    const { error: insertError } = await supabase
      .from('diff_summaries')
      .insert({
        user_id: userId,
        file_name: fileName,
        version1_id: version1Id,
        version2_id: version2Id,
        summary: summary,
        model_used: 'gemini-2.0-flash' // Store the model used
      });

    if (insertError) {
      console.error('Error saving summary to Supabase:', insertError);
      // Still return the summary, but log the DB error
      return NextResponse.json({ summary: summary, warning: 'Failed to save summary to database.' });
    }

    // 6. Return summary
    return NextResponse.json({ summary: summary });

  } catch (error) {
    console.error('Error in Gemini API route:', error);
    // Provide a more specific error message if possible
    const errorMessage = error.message || 'An unexpected error occurred.';
    const status = error.status || 500; // Use error status or default to 500
    // Check for specific API key errors (example, adjust based on actual API errors)
    if (errorMessage.includes('API key not valid')) {
        return NextResponse.json({ error: 'Invalid Gemini API key.' }, { status: 400 });
    }
    return NextResponse.json({ error: `Failed to get summary: ${errorMessage}` }, { status: status });
  }
}
