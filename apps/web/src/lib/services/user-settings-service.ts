// User Settings Service - Allows users to customize their own API keys and configurations
import { createClient } from '@/lib/supabase/client';

export interface UserSettings {
  // AI Provider Keys (encrypted in DB)
  anthropic_api_key?: string;
  openai_api_key?: string;

  // Deployment Tokens
  github_token?: string;
  vercel_token?: string;
  netlify_token?: string;

  // Preferences
  default_framework: 'react' | 'nextjs' | 'vue' | 'svelte';
  default_styling: 'tailwind' | 'css' | 'scss' | 'styled-components';
  default_language: 'typescript' | 'javascript';

  // Editor preferences
  editor_theme: 'vs-dark' | 'light' | 'github-dark' | 'monokai';
  editor_font_size: number;
  editor_tab_size: number;
  editor_word_wrap: boolean;

  // Notification preferences
  email_notifications: boolean;
  deploy_notifications: boolean;
  collaboration_notifications: boolean;

  // Privacy
  profile_public: boolean;
  show_activity: boolean;
}

export interface UserSettingsUpdate extends Partial<UserSettings> {}

const DEFAULT_SETTINGS: UserSettings = {
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

class UserSettingsService {
  // Get user settings
  async getSettings(userId: string): Promise<UserSettings> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // Return defaults if no settings exist
      return DEFAULT_SETTINGS;
    }

    return {
      ...DEFAULT_SETTINGS,
      ...data.settings,
    };
  }

  // Update user settings
  async updateSettings(userId: string, updates: UserSettingsUpdate): Promise<UserSettings> {
    const supabase = createClient();

    // Get current settings
    const current = await this.getSettings(userId);
    const newSettings = { ...current, ...updates };

    // Upsert settings
    const { data, error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        settings: newSettings,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update settings: ${error.message}`);
    }

    return newSettings;
  }

  // Save encrypted API key
  async saveApiKey(
    userId: string,
    keyType: 'anthropic' | 'openai' | 'github' | 'vercel' | 'netlify',
    apiKey: string
  ): Promise<void> {
    const supabase = createClient();

    // In production, encrypt the key before storing
    // Here we store in a separate encrypted column
    const columnMap = {
      anthropic: 'anthropic_api_key',
      openai: 'openai_api_key',
      github: 'github_token',
      vercel: 'vercel_token',
      netlify: 'netlify_token',
    };

    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        [columnMap[keyType]]: apiKey, // Should be encrypted in production
        updated_at: new Date().toISOString(),
      });

    if (error) {
      throw new Error(`Failed to save API key: ${error.message}`);
    }
  }

  // Check if user has their own API key
  async hasApiKey(
    userId: string,
    keyType: 'anthropic' | 'openai' | 'github' | 'vercel' | 'netlify'
  ): Promise<boolean> {
    const supabase = createClient();

    const hasKeyMap: Record<string, string> = {
      anthropic: 'has_anthropic_key',
      openai: 'has_openai_key',
      github: 'has_github_token',
      vercel: 'has_vercel_token',
      netlify: 'has_netlify_token',
    };

    const { data } = await supabase
      .from('user_settings')
      .select(hasKeyMap[keyType])
      .eq('user_id', userId)
      .single();

    if (!data || typeof data !== 'object') return false;
    const record = data as unknown as Record<string, boolean>;
    return !!record[hasKeyMap[keyType]];
  }

  // Get user's API key (decrypted)
  async getApiKey(
    userId: string,
    keyType: 'anthropic' | 'openai' | 'github' | 'vercel' | 'netlify'
  ): Promise<string | null> {
    const supabase = createClient();

    const columnMap: Record<string, string> = {
      anthropic: 'anthropic_api_key',
      openai: 'openai_api_key',
      github: 'github_token',
      vercel: 'vercel_token',
      netlify: 'netlify_token',
    };

    const { data } = await supabase
      .from('user_settings')
      .select(columnMap[keyType])
      .eq('user_id', userId)
      .single();

    if (!data || typeof data !== 'object') return null;
    const record = data as unknown as Record<string, string | null>;
    return record[columnMap[keyType]] || null;
  }

  // Delete API key
  async deleteApiKey(
    userId: string,
    keyType: 'anthropic' | 'openai' | 'github' | 'vercel' | 'netlify'
  ): Promise<void> {
    const supabase = createClient();

    const columnMap = {
      anthropic: 'anthropic_api_key',
      openai: 'openai_api_key',
      github: 'github_token',
      vercel: 'vercel_token',
      netlify: 'netlify_token',
    };

    const { error } = await supabase
      .from('user_settings')
      .update({ [columnMap[keyType]]: null })
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete API key: ${error.message}`);
    }
  }

  // Get effective API key (user's or platform default)
  async getEffectiveApiKey(
    userId: string,
    keyType: 'anthropic' | 'openai' | 'github' | 'vercel' | 'netlify'
  ): Promise<{ key: string | null; source: 'user' | 'platform' }> {
    // First check user's key
    const userKey = await this.getApiKey(userId, keyType);

    if (userKey) {
      return { key: userKey, source: 'user' };
    }

    // Fall back to platform key
    const platformKeyMap: Record<string, string | undefined> = {
      anthropic: process.env.ANTHROPIC_API_KEY,
      openai: process.env.OPENAI_API_KEY,
      github: process.env.GITHUB_TOKEN,
      vercel: process.env.VERCEL_TOKEN,
      netlify: process.env.NETLIFY_TOKEN,
    };

    return {
      key: platformKeyMap[keyType] || null,
      source: 'platform',
    };
  }
}

export const userSettingsService = new UserSettingsService();
