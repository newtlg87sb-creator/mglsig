const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// 1. Supabase бэкенд клайент (Vercel Dashboard дээрх Environment ашиглана)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Vercel Serverless функцын үндсэн ажиллах хэсэг
module.exports = async (req, res) => {
  // Зөвхөн POST хүсэлт хүлээж авна (NOWPayments зөвхөн POST шиддэг)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const ipnSignature = req.headers['x-nowpayments-sig'];
    const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;

    if (!ipnSignature || !ipnSecret) {
      return res.status(400).send('Missing signature or secret');
    }

    // 2. NOWPayments-аас ирсэн өгөгдлийг эрэмбэлж кодлох (Хамгаалалт)
    const sortedData = Object.keys(req.body)
      .sort()
      .reduce((obj, key) => {
        obj[key] = req.body[key];
        return obj;
      }, {});

    const hmac = crypto.createHmac('sha512', ipnSecret);
    hmac.update(JSON.stringify(sortedData));
    const signature = hmac.digest('hex');

    // 3. Хэрэв гарын үсэг зөрвөл хакер гэж үзнэ
    if (signature !== ipnSignature) {
      console.error('⚠️ Анхаар! Баталгаагүй Webhook илэрлээ!');
      return res.status(401).send('Invalid signature');
    }

    // 4. Төлбөрийн мэдээллийг хүлээж авах
    const { payment_status, order_id } = req.body;

    console.log(`Төлбөрийн статус: ${order_id} -> ${payment_status}`);

    // 5. Төлбөр амжилттай 'finished' болсон үед Supabase-ийг шинэчлэх
    if (payment_status === 'finished') {
      const { error } = await supabase
        .from('profiles') // Чиний Supabase дээрх хэрэглэгчийн хүснэгтийн нэр
        .update({ 
          role: 'alpha', // Хэрэглэгчийг Alpha эрхтэй болгох
          premium_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 хоног нэмэх
        }) 
        .eq('id', order_id); // Төлбөр үүсгэхдээ шидсэн Хэрэглэгчийн ID (UUID)

      if (error) {
        console.error('Supabase шинэчлэхэд алдаа гарлаа:', error.message);
        return res.status(500).send('Database update failed');
      }

      console.log(`🎉 Хэрэглэгч ${order_id}-ийн Alpha эрх амжилттай идэвхжлээ!`);
      return res.status(200).send('OK');
    }

    // Хэрэв төлбөр хараахан батлагдаж дуусаагүй (confirming, waiting) бол
    return res.status(200).send('Waiting for confirmation');

  } catch (err) {
    console.error('Webhook алдаа:', err.message);
    return res.status(500).send('Internal Server Error');
  }
};