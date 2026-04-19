import express, { Request, Response } from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { createServer as createViteServer } from "vite";
import path from "path";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_please_change";

// Discord generic app details
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_SERVER_ID = process.env.DISCORD_SERVER_ID;

// Helper to construct Redirect URI dynamically based on request
function getRedirectUri(req: Request) {
  if (process.env.APP_URL) {
    return `${process.env.APP_URL.replace(/\/$/, '')}/auth/callback`;
  }
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${protocol}://${host}/auth/callback`;
}

// 1. Get the OAuth URL for Discord
app.get("/api/auth/url", (req, res) => {
  if (!DISCORD_CLIENT_ID) {
    return res.status(500).json({ error: "DISCORD_CLIENT_ID not configured" });
  }

  const clientRedirectUri = req.query.redirectUri as string;
  const redirectUri = clientRedirectUri || getRedirectUri(req);

  res.cookie("discord_oauth_redirect", redirectUri, {
    secure: true,
    sameSite: "none",
    httpOnly: true,
    maxAge: 10 * 60 * 1000,
  });

  const scopes = ["identify", "guilds"];

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
  });

  const authUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  res.json({ url: authUrl });
});

// 2. Handle the callback from Discord
app.get(["/auth/callback", "/auth/callback/"], async (req: Request, res: Response): Promise<any> => {
  const { code } = req.query;

  if (!code || typeof code !== "string") {
    return res.status(400).send("No code provided");
  }

  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    return res.status(500).send("Discord integration not fully configured.");
  }

  try {
    const redirectUri = req.cookies.discord_oauth_redirect || getRedirectUri(req);
    res.clearCookie("discord_oauth_redirect", { secure: true, sameSite: "none", httpOnly: true });

    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      console.error("Token error:", err);
      return res.status(400).send("Failed to exchange token.");
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Fetch user basic info
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userData = await userResponse.json();

    // Fetch user guilds
    const guildsResponse = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const guildsData = await guildsResponse.json();

    // Check if in server
    let inServer = false;
    if (DISCORD_SERVER_ID && Array.isArray(guildsData)) {
      inServer = guildsData.some((g: any) => g.id === DISCORD_SERVER_ID);
    }

    // Sign JWT
    const payload = {
      id: userData.id,
      username: userData.username,
      avatar: userData.avatar,
      inServer,
    };

    const jwtToken = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });

    // Store in cookie
    res.cookie("discord_session", jwtToken, {
      secure: true,
      sameSite: "none",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Close window and message opener
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("OAuth error:", err);
    res.status(500).send("Failed to process callback");
  }
});

// 3. Current User Endpoint
app.get("/api/auth/me", (req, res) => {
  const token = req.cookies.discord_session;
  if (!token) {
    return res.json({ user: null });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    res.json({ user: verified });
  } catch (err) {
    res.json({ user: null });
  }
});

// 4. Logout
app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("discord_session", {
    secure: true,
    sameSite: "none",
    httpOnly: true,
  });
  res.json({ success: true });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // To support Vite SPA fallback
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const portNum = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;
  app.listen(portNum, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${portNum}`);
  });
}

startServer();
