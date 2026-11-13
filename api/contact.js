// api/contact.js
// Contact form submission handler (Vercel serverless function)
// Stores contact messages in Supabase using the service role key.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey)
  : null;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, email, message } = req.body || {};

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(email))) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    if (!supabase) {
      console.error('Contact form is not configured');
      return res.status(503).json({ error: 'Contact service is not configured' });
    }

    const { error } = await supabase
      .from('contact_messages')
      .insert({
        name: String(name).trim(),
        email: String(email).trim().toLowerCase(),
        message: String(message).trim(),
        created_at: new Date().toISOString()
      });

    if (error) throw error;

    return res.status(200).json({ success: true, message: 'Your message has been sent successfully' });
  } catch (error) {
    console.error('Contact form crash:', error.message);
    return res.status(500).json({ error: 'Failed to send message. Please try again later.' });
  }
}
