module.exports = async (req, res) => {
  const code = req.query.code;
  const client_id = process.env.OAUTH_CLIENT_ID;
  const client_secret = process.env.OAUTH_CLIENT_SECRET;

  if (!client_id || !client_secret) {
    return res.status(500).send("Error: OAUTH_CLIENT_ID or OAUTH_CLIENT_SECRET is missing in Vercel settings.");
  }

  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id,
        client_secret,
        code
      })
    });
    
    const data = await response.json();

    if (data.error) {
      return res.status(400).send(`OAuth Error: ${data.error_description || data.error}`);
    }

    const token = data.access_token;
    const content = JSON.stringify({ token, provider: 'github' });

    // Respond with script to send postMessage authorization to Decap CMS parent window
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Authorizing...</title>
      </head>
      <body>
        <p>Connecting to GitHub, please wait...</p>
        <script>
          const receiveMessage = (e) => {
            window.opener.postMessage(
              'authorization:github:success:${content}',
              e.origin
            );
          };
          window.addEventListener("message", receiveMessage, false);
          window.opener.postMessage("authorizing:github", "*");
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send(`Authentication failed: ${error.message}`);
  }
};
