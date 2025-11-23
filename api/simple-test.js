module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    return res.status(200).json({
      success: true,
      message: 'Simple test endpoint working',
      timestamp: new Date().toISOString(),
      env: {
        has_supabase_url: !!process.env.SUPABASE_URL,
        has_telegram_token: !!process.env.TELEGRAM_BOT_TOKEN,
        node_version: process.version
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};