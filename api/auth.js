module.exports = (req, res) => {
  const client_id = process.env.OAUTH_CLIENT_ID;
  if (!client_id) {
    return res.status(500).send("Error: OAUTH_CLIENT_ID environment variable is not configured in Vercel settings.");
  }
  const redirect_uri = `https://${req.headers.host}/api/callback`;
  res.redirect(`https://github.com/login/oauth/authorize?client_id=${client_id}&scope=repo,user&redirect_uri=${redirect_uri}`);
};
