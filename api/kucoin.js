// api/kucoin.js
export default async function handler(req, res) {
  // Vercel-ийн Edge Network дээр 10 секунд кэшлэнэ. 
  // Энэ нь KuCoin руу очих ачааллыг 99% бууруулж, 429 алдаанаас сэргийлнэ.
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate');

  try {
    const response = await fetch('https://api.kucoin.com/api/v1/market/allTickers');
    if (!response.ok) throw new Error(`KuCoin API error: ${response.status}`);
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch', details: error.message });
  }
}