export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { plan } = req.body || {};
    const plans = {
      alpha: { price: 20, name: 'Alpha' },
      beta: { price: 10, name: 'Beta' }
    };
    const selectedPlan = Object.hasOwn(plans, plan) ? plans[plan] : null;
    if (!selectedPlan) {
      return res.status(400).json({ error: 'Select an available subscription plan' });
    }

    const authHeader = req.headers.authorization || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const nowPaymentsKey = process.env.NOWPAYMENTS_API_KEY;

    if (!accessToken) {
      return res.status(401).json({ error: 'Sign in to purchase a subscription' });
    }

    if (!supabaseUrl || !supabaseKey || !nowPaymentsKey) {
      console.error('Subscription invoice configuration is incomplete');
      return res.status(503).json({ error: 'Payment service is not configured' });
    }

    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseKey,
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
      if (authResponse.status === 401) {
        return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
      }
      return res.status(503).json({ error: 'Unable to verify your account right now. Please try again later.' });
    }
    const user = await authResponse.json();
    if (!user.id) {
      return res.status(401).json({ error: 'Unable to verify your account' });
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
        order_id: `${plan}_${user.id}`,
        order_description: `MGL Signal ${selectedPlan.name} Plan 1-Month Subscription`,
        success_url: `https://mglsignal.com/main_pricing.html?payment=processing&plan=${plan}`,
        cancel_url: 'https://mglsignal.com/main_pricing.html'
      }),
      signal: AbortSignal.timeout(15000)
    });
    const data = await response.json();

    if (response.ok && data.invoice_url) {
      return res.status(200).json({ invoiceUrl: data.invoice_url });
    }

    console.error('NOWPayments invoice creation failed:', data.message || `HTTP ${response.status}`);
    return res.status(502).json({ error: 'Failed to create payment invoice' });
  } catch (error) {
    console.error('Invoice creation crash:', error.message);
    return res.status(502).json({ error: 'Payment service is temporarily unavailable' });
  }
}