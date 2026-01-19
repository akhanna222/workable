// User Settings API - Manage user preferences and API keys
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - Fetch user settings
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user settings
    const { data: settings } = await supabase
      .from('user_settings')
      .select('settings, has_anthropic_key, has_openai_key, has_github_token, has_vercel_token, has_netlify_token')
      .eq('user_id', user.id)
      .single();

    // Default settings
    const defaults = {
      default_framework: 'react',
      default_styling: 'tailwind',
      default_language: 'typescript',
      editor_theme: 'vs-dark',
      editor_font_size: 14,
      editor_tab_size: 2,
      editor_word_wrap: true,
      email_notifications: true,
      deploy_notifications: true,
      collaboration_notifications: true,
      profile_public: false,
      show_activity: true,
    };

    return NextResponse.json({
      settings: { ...defaults, ...settings?.settings },
      connectedServices: {
        anthropic: settings?.has_anthropic_key || false,
        openai: settings?.has_openai_key || false,
        github: settings?.has_github_token || false,
        vercel: settings?.has_vercel_token || false,
        netlify: settings?.has_netlify_token || false,
      },
    });
  } catch (error: any) {
    console.error('Settings fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Update user settings
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { settings } = body;

    // Get existing settings
    const { data: existing } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', user.id)
      .single();

    // Merge settings
    const updatedSettings = {
      ...(existing?.settings || {}),
      ...settings,
    };

    // Upsert
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        settings: updatedSettings,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, settings: updatedSettings });
  } catch (error: any) {
    console.error('Settings update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Save API key
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { keyType, apiKey, action } = body;

    const validKeyTypes = ['anthropic', 'openai', 'github', 'vercel', 'netlify'];
    if (!validKeyTypes.includes(keyType)) {
      return NextResponse.json({ error: 'Invalid key type' }, { status: 400 });
    }

    const columnMap: Record<string, string> = {
      anthropic: 'anthropic_api_key',
      openai: 'openai_api_key',
      github: 'github_token',
      vercel: 'vercel_token',
      netlify: 'netlify_token',
    };

    const hasKeyColumn: Record<string, string> = {
      anthropic: 'has_anthropic_key',
      openai: 'has_openai_key',
      github: 'has_github_token',
      vercel: 'has_vercel_token',
      netlify: 'has_netlify_token',
    };

    if (action === 'delete') {
      // Delete the API key
      const { error } = await supabase
        .from('user_settings')
        .update({
          [columnMap[keyType]]: null,
          [hasKeyColumn[keyType]]: false,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;

      return NextResponse.json({ success: true, message: `${keyType} key deleted` });
    }

    // Validate API key format
    if (!apiKey || apiKey.length < 10) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 400 });
    }

    // In production, encrypt the key before storing
    // For now, we'll store it directly (should use encryption in production)
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        [columnMap[keyType]]: apiKey,
        [hasKeyColumn[keyType]]: true,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;

    return NextResponse.json({ success: true, message: `${keyType} key saved` });
  } catch (error: any) {
    console.error('API key save error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
