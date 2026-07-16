export default async function handler(req, res) {
  const apiKey = process.env.CRYPTOCOMPARE_API_KEY;
  const url = `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&api_key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    
    // Cache results for 5 minutes
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch news', 
      details: error.message 
    });
  }
}