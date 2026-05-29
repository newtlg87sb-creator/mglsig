// api/create-invoice.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

module.exports = async (req, res) => {
  // Зөвхөн POST хүсэлт зөвшөөрнө
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // NOWPayments API руу Invoice үүсгэх хүсэлт шиднэ
    const response = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.NOWPAYMENTS_API_KEY, // Vercel Dashboard дээр тавьсан API Key
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        price_amount: 25,                  // Долларын дүн (Жишээ нь ₮70,000-ыг ~$25 гэж тооцов)
        price_currency: 'usd',             // Үндсэн валют
        order_id: userId,                  // 🚨 МАШ ЧУХАЛ: Саяны нөгөө webhook дээр унших UUID
        order_description: 'MGL Signal Alpha Plan 1-Month Subscription',
        success_url: 'https://mglsignal.com/dashboard?payment=success', // Төлөөд буцаж ирэх хуудас
        cancel_url: 'https://mglsignal.com/pricing'
      })
    });

    const data = await response.json();

    if (data.invoice_url) {
      // Frontend рүү бэлэн болсон төлбөрийн линкийг буцаана
      return res.status(200).json({ invoiceUrl: data.invoice_url });
    } else {
      console.error('NOWPayments Error:', data);
      return res.status(500).json({ error: 'Failed to create invoice from payment provider' });
    }

  } catch (error) {
    console.error('Invoice creation error:', error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};