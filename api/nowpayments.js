import crypto from 'crypto';
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
    const ipnSignature = req.headers['x-nowpayments-sig'];
    const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;

    if (!ipnSignature || !ipnSecret || !supabase) {
      console.error('NOWPayments webhook configuration is incomplete');
      return res.status(503).send('Webhook service is not configured');
    }

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).send('Invalid webhook body');
    }

    const sortedData = Object.keys(req.body)
      .sort()
      .reduce((obj, key) => {
        obj[key] = req.body[key];
        return obj;
      }, {});

    const hmac = crypto.createHmac('sha512', ipnSecret);
    hmac.update(JSON.stringify(sortedData));
    const signature = hmac.digest('hex');
    const receivedSignature = Buffer.from(ipnSignature, 'hex');
    const expectedSignature = Buffer.from(signature, 'hex');

    if (
      receivedSignature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(receivedSignature, expectedSignature)
    ) {
      console.error('Rejected NOWPayments webhook with invalid signature');
      return res.status(401).send('Invalid signature');
    }

    const { payment_status: paymentStatus, order_id: orderId, payment_id: paymentId } = req.body;
    if (paymentStatus !== 'finished') {
      return res.status(200).send('Waiting for confirmation');
    }

    const orderMatch = typeof orderId === 'string'
      ? orderId.match(/^alpha_([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i)
      : null;
    if (!orderMatch) {
      return res.status(200).send('Not an Alpha subscription');
    }
    if (paymentId === undefined || paymentId === null || String(paymentId).length === 0) {
      console.error('Finished Alpha payment is missing payment_id');
      return res.status(400).send('Missing payment ID');
    }

    const { data: activated, error } = await supabase.rpc('activate_alpha_subscription', {
      p_user_id: orderMatch[1],
      p_payment_id: String(paymentId)
    });
    if (error) {
      console.error('Failed to activate Alpha subscription:', error.message);
      return res.status(500).send('Database update failed');
    }

    return res.status(200).send(activated ? 'Alpha access activated' : 'Payment already processed');

  } catch (err) {
    console.error('NOWPayments webhook failed:', err.message);
    return res.status(500).send('Internal Server Error');
  }
}