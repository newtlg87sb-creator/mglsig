import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey)
  : null;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { plan } = req.body || {};
    const plans = {
      alpha: { price: 20, name: 'Alpha' },
      beta: { price: 10, name: 'Beta' },
      gamma: { price: 10, name: 'Gamma' }
    };
    const selectedPlan = Object.hasOwn(plans, plan) ? plans[plan] : null;
    if (!selectedPlan) {
      return res.status(400).json({ error: 'Select an available subscription plan' });
    }

    const authHeader = req.headers.authorization || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseApiKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
    const nowPaymentsKey = process.env.NOWPAYMENTS_API_KEY;

    if (!accessToken) {
      return res.status(401).json({ error: 'Sign in to purchase a subscription' });
    }

    if (!supabaseUrl || !supabaseApiKey || !nowPaymentsKey || !supabase) {
      console.error('Subscription invoice configuration is incomplete');
      return res.status(503).json({ error: 'Payment service is not configured' });
    }

    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseApiKey,
        Authorization: `Bearer ${accessToken}`
      },
      signal: AbortSignal.timeout(10000)
    });
    if (!authResponse.ok) {
      const authError = await authResponse.json().catch(() => ({}));
      console.error('Supabase rejected subscription session:', {
        status: authResponse.status,
        code: authError.code,
        message: authError.msg || authError.message || authError.error_description
      });
      if (authResponse.status === 401 && authError.code !== 'unregistered_api_key') {
        return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
      }
      return res.status(503).json({ error: 'Unable to verify your account right now. Please try again later.' });
    }
    const user = await authResponse.json();
    if (!user.id) {
      return res.status(401).json({ error: 'Unable to verify your account' });
    }

    const orderId = randomUUID();
    const { error: orderError } = await supabase
      .from('subscription_orders')
      .insert({
        order_id: orderId,
        user_id: user.id,
        plan,
        price_amount: selectedPlan.price,
        price_currency: 'usd',
        pay_currency: 'usdtbsc'
      });
    if (orderError) {
      console.error('Failed to record subscription order:', orderError.message);
      return res.status(503).json({ error: 'Unable to create a payment order right now' });
    }

    const response = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'x-api-key': nowPaymentsKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        price_amount: selectedPlan.price,
        price_currency: 'usd',
        pay_currency: 'usdtbsc',
        order_id: `subscription_${orderId}`,
        order_description: `MGL Signal ${selectedPlan.name} Plan 1-Month Subscription`,
        success_url: `https://mglsignal.com/main_pricing.html?payment=processing&plan=${plan}`,
        cancel_url: 'https://mglsignal.com/main_pricing.html'
      }),
      signal: AbortSignal.timeout(15000)
    });
    const data = await response.json();

    if (response.ok && data.invoice_url && data.invoice_id !== undefined && data.invoice_id !== null) {
      const { error: invoiceUpdateError } = await supabase
        .from('subscription_orders')
        .update({ invoice_id: String(data.invoice_id) })
        .eq('order_id', orderId)
        .eq('status', 'pending');
      if (invoiceUpdateError) {
        console.error('Failed to link provider invoice to subscription order:', invoiceUpdateError.message);
        return res.status(502).json({ error: 'Failed to prepare payment invoice' });
      }
      return res.status(200).json({ invoiceUrl: data.invoice_url });
    }

    await supabase
      .from('subscription_orders')
      .update({ status: 'cancelled' })
      .eq('order_id', orderId)
      .eq('status', 'pending');
    console.error('NOWPayments invoice creation failed:', data.message || `HTTP ${response.status}`);
    return res.status(502).json({ error: 'Failed to create payment invoice' });
  } catch (error) {
    console.error('Invoice creation crash:', error.message);
    return res.status(502).json({ error: 'Payment service is temporarily unavailable' });
  }
}