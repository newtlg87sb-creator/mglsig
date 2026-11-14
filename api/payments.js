import crypto from 'crypto';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseApiKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const nowPaymentsKey = process.env.NOWPAYMENTS_API_KEY;
const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
const ipnCallbackUrl = process.env.NOWPAYMENTS_IPN_CALLBACK_URL ||
  'https://mglsignal.com/api/payments?action=webhook';
const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey)
  : null;

const plans = {
  alpha: { price: 20, name: 'Alpha' },
  beta: { price: 10, name: 'Beta' },
  gamma: { price: 10, name: 'Gamma' }
};

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function markOrderCancelled(table, orderId) {
  return supabase
    .from(table)
    .update({ status: 'cancelled' })
    .eq('order_id', orderId)
    .eq('status', 'pending');
}

function getInvoiceId(data) {
  const invoiceId = data?.id ?? data?.invoice_id;
  return invoiceId === undefined || invoiceId === null || String(invoiceId).trim() === ''
    ? null
    : String(invoiceId);
}

async function createSubscriptionInvoice(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = isObject(req.body) ? req.body : {};
    const plan = body.plan;
    const selectedPlan = Object.hasOwn(plans, plan) ? plans[plan] : null;
    if (!selectedPlan) {
      return res.status(400).json({ error: 'Select an available subscription plan' });
    }

    const authHeader = req.headers.authorization || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
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
        ipn_callback_url: ipnCallbackUrl,
        order_id: `subscription_${orderId}`,
        order_description: `MGL Signal ${selectedPlan.name} Plan 1-Month Subscription`,
        success_url: `https://mglsignal.com/main_pricing.html?payment=processing&plan=${plan}`,
        cancel_url: 'https://mglsignal.com/main_pricing.html'
      }),
      signal: AbortSignal.timeout(15000)
    });
    const data = await response.json();
    const invoiceId = getInvoiceId(data);

    if (response.ok && typeof data?.invoice_url === 'string' && data.invoice_url && invoiceId) {
      const { error: invoiceUpdateError } = await supabase
        .from('subscription_orders')
        .update({ invoice_id: invoiceId })
        .eq('order_id', orderId)
        .eq('status', 'pending');
      if (invoiceUpdateError) {
        console.error('Failed to link provider invoice to subscription order:', invoiceUpdateError.message);
        return res.status(502).json({ error: 'Failed to prepare payment invoice' });
      }
      return res.status(200).json({ invoiceUrl: data.invoice_url });
    }

    const { error: cancelError } = await markOrderCancelled('subscription_orders', orderId);
    if (cancelError) {
      console.error('Failed to cancel subscription order after invoice failure:', cancelError.message);
    }
    console.error('NOWPayments invoice creation failed:', {
      status: response.status,
      message: data?.message,
      responseFields: isObject(data) ? Object.keys(data) : []
    });
    return res.status(502).json({ error: 'Failed to create payment invoice' });
  } catch (error) {
    console.error('Subscription invoice creation failed:', error.message);
    return res.status(502).json({ error: 'Payment service is temporarily unavailable' });
  }
}

async function createDonationInvoice(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const amount = Number(req.body?.price_amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'A valid donation amount is required' });
    }
    if (!nowPaymentsKey || !supabase) {
      console.error('Donation invoice configuration is incomplete');
      return res.status(503).json({ error: 'Payment service is not configured' });
    }

    const orderId = randomUUID();
    const { error: orderError } = await supabase
      .from('donation_orders')
      .insert({
        order_id: orderId,
        price_amount: amount,
        price_currency: 'usd',
        pay_currency: 'usdtbsc'
      });
    if (orderError) {
      console.error('Failed to record donation order:', orderError.message);
      return res.status(503).json({ error: 'Unable to create a donation order right now' });
    }

    const response = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'x-api-key': nowPaymentsKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: 'usd',
        pay_currency: 'usdtbsc',
        ipn_callback_url: ipnCallbackUrl,
        order_id: `donation_${orderId}`,
        order_description: `MGL Signal Donation - $${amount}`,
        success_url: 'https://mglsignal.com/main_about.html?payment=success',
        cancel_url: 'https://mglsignal.com/main_about.html'
      }),
      signal: AbortSignal.timeout(15000)
    });
    const data = await response.json();
    const invoiceId = getInvoiceId(data);

    if (response.ok && typeof data?.invoice_url === 'string' && data.invoice_url && invoiceId) {
      const { error: invoiceUpdateError } = await supabase
        .from('donation_orders')
        .update({ invoice_id: invoiceId })
        .eq('order_id', orderId)
        .eq('status', 'pending');
      if (invoiceUpdateError) {
        console.error('Failed to link provider invoice to donation order:', invoiceUpdateError.message);
        return res.status(502).json({ error: 'Failed to prepare donation invoice' });
      }
      return res.status(200).json({ invoiceUrl: data.invoice_url });
    }

    const { error: cancelError } = await markOrderCancelled('donation_orders', orderId);
    if (cancelError) {
      console.error('Failed to cancel donation order after invoice failure:', cancelError.message);
    }
    console.error('NOWPayments donation invoice creation failed:', {
      status: response.status,
      message: data?.message,
      responseFields: isObject(data) ? Object.keys(data) : []
    });
    return res.status(502).json({ error: 'Failed to create donation invoice' });
  } catch (error) {
    console.error('Donation invoice creation failed:', error.message);
    return res.status(502).json({ error: 'Payment service is temporarily unavailable' });
  }
}

function verifyWebhookSignature(req) {
  const receivedSignature = req.headers['x-nowpayments-sig'];
  if (!ipnSecret) {
    return { configurationError: true };
  }
  if (typeof receivedSignature !== 'string' || !/^[a-f0-9]{128}$/i.test(receivedSignature)) {
    return { valid: false };
  }

  const sortedData = Object.keys(req.body)
    .sort()
    .reduce((data, key) => {
      data[key] = req.body[key];
      return data;
    }, {});
  const expectedSignature = crypto
    .createHmac('sha512', ipnSecret)
    .update(JSON.stringify(sortedData))
    .digest();
  const signatureBuffer = Buffer.from(receivedSignature, 'hex');

  return {
    valid: signatureBuffer.length === expectedSignature.length &&
      crypto.timingSafeEqual(signatureBuffer, expectedSignature)
  };
}

async function handleWebhook(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  if (!supabase) {
    console.error('NOWPayments webhook Supabase configuration is incomplete');
    return res.status(503).send('Webhook service is not configured');
  }
  if (!isObject(req.body)) {
    return res.status(400).send('Invalid webhook body');
  }

  const signature = verifyWebhookSignature(req);
  if (signature.configurationError) {
    console.error('NOWPayments IPN secret is not configured');
    return res.status(503).send('Webhook service is not configured');
  }
  if (!signature.valid) {
    console.error('Rejected NOWPayments webhook with invalid signature');
    return res.status(401).send('Invalid signature');
  }

  const { payment_status: paymentStatus, order_id: orderId, payment_id: paymentId } = req.body;
  if (paymentStatus !== 'finished') {
    return res.status(200).send('Waiting for confirmation');
  }

  const orderMatch = typeof orderId === 'string'
    ? orderId.match(/^(subscription|donation)_([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i)
    : null;
  if (!orderMatch) {
    return res.status(200).send('Not a supported payment');
  }

  const invoiceId = req.body.invoice_id;
  const paidAmount = Number(req.body.price_amount);
  const paidCurrency = typeof req.body.price_currency === 'string'
    ? req.body.price_currency.toLowerCase()
    : '';
  const payCurrency = typeof req.body.pay_currency === 'string'
    ? req.body.pay_currency.toLowerCase()
    : '';
  if (
    paymentId === undefined || paymentId === null || String(paymentId).length === 0 ||
    invoiceId === undefined || invoiceId === null || String(invoiceId).length === 0 ||
    !Number.isFinite(paidAmount) || !paidCurrency || !payCurrency
  ) {
    console.error('Finished payment is missing invoice details');
    return res.status(400).send('Missing invoice details');
  }

  try {
    const isSubscription = orderMatch[1].toLowerCase() === 'subscription';
    const { data: processed, error } = isSubscription
      ? await supabase.rpc('activate_subscription_order', {
        p_order_id: orderMatch[2],
        p_invoice_id: String(invoiceId),
        p_payment_id: String(paymentId),
        p_paid_amount: paidAmount,
        p_paid_currency: paidCurrency,
        p_pay_currency: payCurrency
      })
      : await supabase.rpc('process_donation_order_payment', {
        p_order_id: orderMatch[2],
        p_invoice_id: String(invoiceId),
        p_payment_id: String(paymentId),
        p_paid_amount: paidAmount,
        p_paid_currency: paidCurrency,
        p_pay_currency: payCurrency
      });

    if (error) {
      console.error(`Failed to validate or process ${isSubscription ? 'subscription' : 'donation'} payment:`, error.message);
      return res.status(400).send('Payment does not match a valid order');
    }

    if (isSubscription) {
      return res.status(200).send(processed ? 'Subscription access activated' : 'Payment already processed');
    }
    return res.status(200).send(processed ? 'Donation recorded' : 'Donation already recorded');
  } catch (error) {
    console.error('NOWPayments webhook failed:', error.message);
    return res.status(500).send('Internal Server Error');
  }
}

export default async function handler(req, res) {
  const action = typeof req.query?.action === 'string' ? req.query.action : '';

  if (action === 'subscription') {
    return createSubscriptionInvoice(req, res);
  }
  if (action === 'donation') {
    return createDonationInvoice(req, res);
  }
  if (action === 'webhook') {
    return handleWebhook(req, res);
  }
  return res.status(400).json({ error: 'A valid payment action is required' });
}