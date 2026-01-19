// Stripe Billing Service
import { createClient } from '@/lib/supabase/client';

export interface Plan {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  stripePriceIdMonthly: string;
  stripePriceIdYearly: string;
  features: string[];
  limits: {
    projects: number;
    aiRequests: number;
    storage: number; // in GB
    collaborators: number;
  };
}

export interface Subscription {
  id: string;
  planId: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface UsageStats {
  projects: { used: number; limit: number };
  aiRequests: { used: number; limit: number };
  storage: { used: number; limit: number };
  collaborators: { used: number; limit: number };
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'For hobbyists and learning',
    priceMonthly: 0,
    priceYearly: 0,
    stripePriceIdMonthly: '',
    stripePriceIdYearly: '',
    features: [
      '3 Projects',
      '50 AI Requests/month',
      '1GB Storage',
      'Community Support',
    ],
    limits: {
      projects: 3,
      aiRequests: 50,
      storage: 1,
      collaborators: 1,
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For professionals and small teams',
    priceMonthly: 19,
    priceYearly: 190,
    stripePriceIdMonthly: 'price_pro_monthly',
    stripePriceIdYearly: 'price_pro_yearly',
    features: [
      'Unlimited Projects',
      '500 AI Requests/month',
      '10GB Storage',
      'Priority Support',
      'GitHub Integration',
      'Custom Domains',
    ],
    limits: {
      projects: -1, // unlimited
      aiRequests: 500,
      storage: 10,
      collaborators: 5,
    },
  },
  {
    id: 'team',
    name: 'Team',
    description: 'For growing teams',
    priceMonthly: 49,
    priceYearly: 490,
    stripePriceIdMonthly: 'price_team_monthly',
    stripePriceIdYearly: 'price_team_yearly',
    features: [
      'Everything in Pro',
      '2000 AI Requests/month',
      '50GB Storage',
      'Team Collaboration',
      'Version History',
      'API Access',
    ],
    limits: {
      projects: -1,
      aiRequests: 2000,
      storage: 50,
      collaborators: 20,
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations',
    priceMonthly: 199,
    priceYearly: 1990,
    stripePriceIdMonthly: 'price_enterprise_monthly',
    stripePriceIdYearly: 'price_enterprise_yearly',
    features: [
      'Everything in Team',
      'Unlimited AI Requests',
      'Unlimited Storage',
      'Dedicated Support',
      'SSO/SAML',
      'Custom Contracts',
      'SLA Guarantee',
    ],
    limits: {
      projects: -1,
      aiRequests: -1,
      storage: -1,
      collaborators: -1,
    },
  },
];

class BillingService {
  private supabase = createClient();

  // Get user's current subscription
  async getSubscription(userId: string): Promise<Subscription | null> {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      planId: data.plan_id,
      status: data.status,
      currentPeriodStart: data.current_period_start,
      currentPeriodEnd: data.current_period_end,
      cancelAtPeriodEnd: data.cancel_at_period_end,
    };
  }

  // Get user's current plan
  async getCurrentPlan(userId: string): Promise<Plan> {
    const subscription = await this.getSubscription(userId);
    if (!subscription) {
      return PLANS.find(p => p.id === 'free')!;
    }
    return PLANS.find(p => p.id === subscription.planId) || PLANS[0];
  }

  // Get usage stats
  async getUsageStats(userId: string): Promise<UsageStats> {
    const plan = await this.getCurrentPlan(userId);

    // Get project count
    const { count: projectCount } = await this.supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', userId);

    // Get AI requests this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: aiRequestCount } = await this.supabase
      .from('ai_requests')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString());

    // Get storage used (simplified - would need actual calculation)
    const { data: files } = await this.supabase
      .from('files')
      .select('content')
      .eq('created_by', userId);

    const storageUsedBytes = files?.reduce((acc, f) => acc + (f.content?.length || 0), 0) || 0;
    const storageUsedGB = storageUsedBytes / (1024 * 1024 * 1024);

    // Get collaborator count
    const { count: collaboratorCount } = await this.supabase
      .from('workspace_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    return {
      projects: {
        used: projectCount || 0,
        limit: plan.limits.projects,
      },
      aiRequests: {
        used: aiRequestCount || 0,
        limit: plan.limits.aiRequests,
      },
      storage: {
        used: Math.round(storageUsedGB * 100) / 100,
        limit: plan.limits.storage,
      },
      collaborators: {
        used: collaboratorCount || 0,
        limit: plan.limits.collaborators,
      },
    };
  }

  // Check if user can perform an action based on limits
  async checkLimit(userId: string, resource: keyof UsageStats): Promise<boolean> {
    const stats = await this.getUsageStats(userId);
    const stat = stats[resource];

    // -1 means unlimited
    if (stat.limit === -1) return true;

    return stat.used < stat.limit;
  }

  // Create checkout session
  async createCheckoutSession(
    userId: string,
    planId: string,
    billingCycle: 'monthly' | 'yearly'
  ): Promise<{ url: string }> {
    const plan = PLANS.find(p => p.id === planId);
    if (!plan) throw new Error('Invalid plan');

    const priceId = billingCycle === 'monthly'
      ? plan.stripePriceIdMonthly
      : plan.stripePriceIdYearly;

    // Call our API to create Stripe checkout session
    const response = await fetch('/api/billing/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        priceId,
        planId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create checkout session');
    }

    return response.json();
  }

  // Create customer portal session
  async createPortalSession(userId: string): Promise<{ url: string }> {
    const response = await fetch('/api/billing/create-portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create portal session');
    }

    return response.json();
  }

  // Cancel subscription
  async cancelSubscription(userId: string): Promise<void> {
    const response = await fetch('/api/billing/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to cancel subscription');
    }
  }

  // Log AI request for usage tracking
  async logAIRequest(userId: string, projectId: string, tokens: number): Promise<void> {
    await this.supabase.from('ai_requests').insert({
      user_id: userId,
      project_id: projectId,
      tokens_used: tokens,
    });
  }
}

export const billingService = new BillingService();
