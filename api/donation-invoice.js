// api/donation-invoice.js
// Динамик дүнтэй хандив үүсгэх бэкенд код
import { randomUUID } from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const amount = Number(req.body?.price_amount);
    const apiKey = process.env.NOWPAYMENTS_API_KEY;

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'A valid donation amount is required' });
    }
    if (!apiKey) {
      console.error('Donation invoice configuration is incomplete');
      return res.status(503).json({ error: 'Payment service is not configured' });
    }

    // NOWPayments API руу хүсэлт шиднэ
    const response = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: 'usd',
        pay_currency: 'usdtbsc', // USDT (BEP20) default
        order_id: `donation_${randomUUID()}`,
        order_description: `MGL Signal Donation - $${amount}`,
        success_url: 'https://mglsignal.com/main_about.html?payment=success',
        cancel_url: 'https://mglsignal.com/main_about.html'
      })
    });

    const data = await response.json();

    if (data.invoice_url) {
      return res.status(200).json({ invoiceUrl: data.invoice_url });
    } else {
      console.error('NOWPayments Error response:', data);
      return res.status(500).json({ error: data.message || 'Failed to create donation invoice' });
    }

  } catch (error) {
    console.error('Donation Invoice crash:', error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}