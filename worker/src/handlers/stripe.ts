/**
 * Stripe Subscription Handlers
 * Checkout, webhooks, and subscription management
 */

import type { Env, User } from '../types';
import { ApiError } from '../types';
import { requireAuth } from './auth';

interface StripeCheckoutSession {
  id: string;
  url: string;
}

interface StripeCustomer {
  id: string;
  email: string;
}

interface StripeSubscriptionItem {
  id: string;
  price: {
    id: string;
  };
  quantity: number;
}

interface StripeSubscription {
  id: string;
  status: string;
  customer: string;
  items: {
    data: StripeSubscriptionItem[];
  };
}

interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

/**
 * Create Stripe Checkout session for Pro subscription
 */
export async function handleCreateCheckout(
  request: Request,
  env: Env
): Promise<Response> {
  const user = await requireAuth(request, env);
  
  if (user.subscription_tier === 'pro' && user.subscription_status === 'active') {
    throw new ApiError(400, 'Already subscribed to Pro');
  }
  
  const body = await request.json() as { extra_quota_packs?: number };
  const extraPacks = body.extra_quota_packs || 0;
  
  // Get or create Stripe customer
  let customerId = user.stripe_customer_id;
  if (!customerId) {
    customerId = await createStripeCustomer(env, user);
    await env.DB.prepare(
      'UPDATE users SET stripe_customer_id = ?, updated_at = ? WHERE id = ?'
    ).bind(customerId, Date.now(), user.id).run();
  }
  
  const url = new URL(request.url);
  const successUrl = `${url.origin}/dashboard?checkout=success`;
  const cancelUrl = `${url.origin}/dashboard?checkout=canceled`;
  
  // Build line items
  const lineItems: Array<{ price: string; quantity: number }> = [
    { price: env.STRIPE_PRICE_ID_PRO, quantity: 1 },
  ];
  
  if (extraPacks > 0) {
    lineItems.push({ price: env.STRIPE_PRICE_ID_QUOTA, quantity: extraPacks });
  }
  
  // Create checkout session
  const session = await createCheckoutSession(env, {
    customer: customerId,
    lineItems,
    successUrl,
    cancelUrl,
    metadata: {
      user_id: user.id,
      extra_quota_packs: extraPacks.toString(),
    },
  });
  
  return Response.json({ url: session.url });
}

/**
 * Create Stripe Customer Portal session
 */
export async function handleCustomerPortal(
  request: Request,
  env: Env
): Promise<Response> {
  const user = await requireAuth(request, env);
  
  if (!user.stripe_customer_id) {
    throw new ApiError(400, 'No subscription found');
  }
  
  const url = new URL(request.url);
  const returnUrl = `${url.origin}/dashboard`;
  
  const portalSession = await createPortalSession(env, user.stripe_customer_id, returnUrl);
  
  return Response.json({ url: portalSession.url });
}

/**
 * Add extra quota packs
 */
export async function handleAddQuotaPack(
  request: Request,
  env: Env
): Promise<Response> {
  const user = await requireAuth(request, env);
  
  if (user.subscription_tier !== 'pro') {
    throw new ApiError(400, 'Pro subscription required');
  }
  
  if (!user.stripe_subscription_id) {
    throw new ApiError(400, 'No active subscription');
  }
  
  const body = await request.json() as { packs: number };
  const packsToAdd = body.packs || 1;
  
  // Update subscription to add quota items
  await updateSubscriptionQuota(env, user.stripe_subscription_id, user.extra_quota_packs + packsToAdd);
  
  // Update user in DB
  await env.DB.prepare(
    'UPDATE users SET extra_quota_packs = extra_quota_packs + ?, updated_at = ? WHERE id = ?'
  ).bind(packsToAdd, Date.now(), user.id).run();
  
  return Response.json({ 
    success: true, 
    extra_quota_packs: user.extra_quota_packs + packsToAdd,
    max_deployments: 10 + ((user.extra_quota_packs + packsToAdd) * 5),
  });
}

/**
 * Handle Stripe webhooks
 */
export async function handleStripeWebhook(
  request: Request,
  env: Env
): Promise<Response> {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    throw new ApiError(400, 'Missing stripe-signature header');
  }
  
  const body = await request.text();
  
  // Verify webhook signature
  const event = await verifyWebhookSignature(body, signature, env.STRIPE_WEBHOOK_SECRET);
  
  console.log(`Stripe webhook received: ${event.type}`);
  
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(env, event.data.object as Record<string, unknown>);
      break;
      
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(env, event.data.object as unknown as StripeSubscription);
      break;
      
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(env, event.data.object as unknown as StripeSubscription);
      break;
      
    case 'invoice.payment_failed':
      await handlePaymentFailed(env, event.data.object as Record<string, unknown>);
      break;
      
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
  
  return Response.json({ received: true });
}

// ============================================
// Webhook Event Handlers
// ============================================

async function handleCheckoutCompleted(
  env: Env,
  session: Record<string, unknown>
): Promise<void> {
  const metadata = session.metadata as { user_id: string; extra_quota_packs: string } | undefined;
  if (!metadata?.user_id) {
    console.error('No user_id in checkout session metadata');
    return;
  }
  
  const subscriptionId = session.subscription as string;
  const extraPacks = parseInt(metadata.extra_quota_packs || '0', 10);
  
  await env.DB.prepare(`
    UPDATE users SET 
      subscription_tier = 'pro',
      subscription_status = 'active',
      stripe_subscription_id = ?,
      extra_quota_packs = ?,
      updated_at = ?
    WHERE id = ?
  `).bind(subscriptionId, extraPacks, Date.now(), metadata.user_id).run();
  
  console.log(`User ${metadata.user_id} upgraded to Pro with ${extraPacks} extra packs`);
}

async function handleSubscriptionUpdated(
  env: Env,
  subscription: StripeSubscription
): Promise<void> {
  const customerId = subscription.customer;
  
  // Find user by stripe_customer_id
  const user = await env.DB.prepare(
    'SELECT * FROM users WHERE stripe_customer_id = ?'
  ).bind(customerId).first<User>();
  
  if (!user) {
    console.error(`No user found for customer ${customerId}`);
    return;
  }
  
  // Count quota packs from subscription items
  let extraPacks = 0;
  for (const item of subscription.items.data) {
    if (item.price.id === env.STRIPE_PRICE_ID_QUOTA) {
      extraPacks = item.quantity;
    }
  }
  
  const status = mapStripeStatus(subscription.status);
  
  await env.DB.prepare(`
    UPDATE users SET 
      subscription_status = ?,
      stripe_subscription_id = ?,
      extra_quota_packs = ?,
      updated_at = ?
    WHERE id = ?
  `).bind(status, subscription.id, extraPacks, Date.now(), user.id).run();
}

async function handleSubscriptionDeleted(
  env: Env,
  subscription: StripeSubscription
): Promise<void> {
  const customerId = subscription.customer;
  
  await env.DB.prepare(`
    UPDATE users SET 
      subscription_tier = 'free',
      subscription_status = 'canceled',
      stripe_subscription_id = NULL,
      extra_quota_packs = 0,
      custom_domain = NULL,
      custom_domain_verified = 0,
      updated_at = ?
    WHERE stripe_customer_id = ?
  `).bind(Date.now(), customerId).run();
  
  console.log(`Subscription canceled for customer ${customerId}`);
}

async function handlePaymentFailed(
  env: Env,
  invoice: Record<string, unknown>
): Promise<void> {
  const customerId = invoice.customer as string;
  
  await env.DB.prepare(`
    UPDATE users SET 
      subscription_status = 'past_due',
      updated_at = ?
    WHERE stripe_customer_id = ?
  `).bind(Date.now(), customerId).run();
  
  console.log(`Payment failed for customer ${customerId}`);
}

// ============================================
// Stripe API Helpers
// ============================================

async function createStripeCustomer(env: Env, user: User): Promise<string> {
  const response = await fetch('https://api.stripe.com/v1/customers', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      email: user.email,
      name: user.name || '',
      'metadata[user_id]': user.id,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new ApiError(500, `Failed to create Stripe customer: ${error}`);
  }
  
  const customer: StripeCustomer = await response.json();
  return customer.id;
}

async function createCheckoutSession(
  env: Env,
  options: {
    customer: string;
    lineItems: Array<{ price: string; quantity: number }>;
    successUrl: string;
    cancelUrl: string;
    metadata: Record<string, string>;
  }
): Promise<StripeCheckoutSession> {
  const params = new URLSearchParams({
    customer: options.customer,
    mode: 'subscription',
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
  });
  
  options.lineItems.forEach((item, index) => {
    params.append(`line_items[${index}][price]`, item.price);
    params.append(`line_items[${index}][quantity]`, item.quantity.toString());
  });
  
  Object.entries(options.metadata).forEach(([key, value]) => {
    params.append(`metadata[${key}]`, value);
  });
  
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new ApiError(500, `Failed to create checkout session: ${error}`);
  }
  
  return response.json();
}

async function createPortalSession(
  env: Env,
  customerId: string,
  returnUrl: string
): Promise<{ url: string }> {
  const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      customer: customerId,
      return_url: returnUrl,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new ApiError(500, `Failed to create portal session: ${error}`);
  }
  
  return response.json();
}

async function updateSubscriptionQuota(
  env: Env,
  subscriptionId: string,
  totalPacks: number
): Promise<void> {
  // Get current subscription
  const getResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
    },
  });
  
  if (!getResponse.ok) {
    throw new ApiError(500, 'Failed to get subscription');
  }
  
  const subscription: StripeSubscription = await getResponse.json();
  
  // Find quota item
  const quotaItem = subscription.items.data.find(
    item => item.price.id === env.STRIPE_PRICE_ID_QUOTA
  );
  
  if (quotaItem) {
    // Update existing item quantity
    await fetch(`https://api.stripe.com/v1/subscription_items/${quotaItem.id}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        quantity: totalPacks.toString(),
      }),
    });
  } else {
    // Add new item
    await fetch('https://api.stripe.com/v1/subscription_items', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        subscription: subscriptionId,
        price: env.STRIPE_PRICE_ID_QUOTA,
        quantity: totalPacks.toString(),
      }),
    });
  }
}

// ============================================
// Webhook Signature Verification
// ============================================

async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<StripeEvent> {
  const parts = signature.split(',');
  const timestampPart = parts.find(p => p.startsWith('t='));
  const signaturePart = parts.find(p => p.startsWith('v1='));
  
  if (!timestampPart || !signaturePart) {
    throw new ApiError(400, 'Invalid signature format');
  }
  
  const timestamp = timestampPart.split('=')[1];
  const expectedSignature = signaturePart.split('=')[1];
  
  // Check timestamp (allow 5 minutes tolerance)
  const timestampNum = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestampNum) > 300) {
    throw new ApiError(400, 'Webhook timestamp too old');
  }
  
  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signedPayload)
  );
  
  const computedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  if (computedSignature !== expectedSignature) {
    throw new ApiError(400, 'Invalid webhook signature');
  }
  
  return JSON.parse(payload);
}

function mapStripeStatus(stripeStatus: string): 'active' | 'canceled' | 'past_due' {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    default:
      return 'canceled';
  }
}
