export const FREE_DAILY_ANALYSES = 3;
export type Access = { tier: 'free' | 'pro' | 'pro_plus'; remaining: number | null; limit: number | null; resetAt: string; billingReady: boolean; checkoutReady: boolean; preview: boolean; managementUrl?: string };
export const ENTITLEMENTS = { pro: 'premium', pro_plus: 'fitmacro.pro_plus.monthly' };
