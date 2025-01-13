const express = require("express");
const session = require("express-session");
const axios = require("axios");
const dotenv = require("dotenv");
const crypto = require("crypto");
const proxy = require("express-http-proxy");

dotenv.config();

const { OKTA_DOMAIN, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, FRONTEND_URL, SESSION_SECRET } = process.env;
const ISSUER_URI = `${OKTA_DOMAIN}/oauth2/default`;

const app = express();

app.use(
  session({
    secret: SESSION_SECRET || "no_secret", // Replace with a strong secret
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === "production",
    }
  })
);

//generate a random value for state and nonce
function generateRandomValue() {
  return crypto.randomBytes(16).toString("base64url"); // URL-safe base64 string
}

// Function to exchange the authorization code for tokens
async function exchangeAuthorizationCodeForTokens(code) {
  const tokenUrl = `${ISSUER_URI}/v1/token`;

  const payload = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });

  try {
    const response = await axios.post(tokenUrl, payload.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const { id_token, access_token, refresh_token } = response.data;
    return { id_token, access_token, refresh_token };
  } catch (error) {
    console.error("Error exchanging authorization code for tokens:", error.response?.data || error.message);
    throw new Error("Token exchange failed");
  }
}

app.get("/login", (req, res) => {
  const state = generateRandomValue();
  const nonce = generateRandomValue();

  req.session.state = state;
  req.session.nonce = nonce;

  const queryParams = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: "openid profile email",
    state,
    nonce,
  });

  // Build the authorization URL pointing directly to Okta
  const authUrl = `${ISSUER_URI}/v1/authorize?${queryParams.toString()}`;
  console.log("Rewritten Path:", authUrl); // Log the rewritten path
  
  res.redirect(authUrl);
});

app.get(
  "/test-okta",
  proxy(OKTA_DOMAIN, {
    proxyReqPathResolver: (req) => {
      const state = generateRandomValue();
      const nonce = generateRandomValue();

      req.session.state = state;
      req.session.nonce = nonce;

      const queryParams = new URLSearchParams({
        response_type: "code",
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: "openid profile email",
        state,
        nonce,
      });

      const resolvedPath = `/oauth2/default/v1/authorize?${queryParams.toString()}`;
      console.log("Rewritten Path:", resolvedPath); // Log the rewritten path
      return resolvedPath;
    },
    proxyReqOptDecorator: (proxyReqOpts) => {
      // Explicitly set the Host header to match the Okta domain
      proxyReqOpts.headers["Host"] = OKTA_DOMAIN.replace(/^https?:\/\//, ""); // Remove protocol
      proxyReqOpts.headers["X-Custom-Header"] = "TestingOktaRewrite";

      // set the user agent to mimic Chrome or other modern browser, to try and solve internal server error when using proxy() rewrite
      proxyReqOpts.headers["User-Agent"] =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
  
      console.log("Rewritten Host:", proxyReqOpts.headers["Host"]);
      console.log("Headers being sent:", proxyReqOpts.headers);
      return proxyReqOpts;
    },
    // Enable verbose logging to debug issues with the proxy request
    verbose: true,
  })
);

app.get("/callback", (req, res) => {
  const { code, state } = req.query;

  // Verify state to prevent CSRF attacks
  if (state !== req.session.state) {
    return res.status(400).send("Invalid state. Possible CSRF attack.");
  }

  // Redirect to the frontend with the authorization code for testing purposes
  console.log("Authorization code received:", code);
  res.redirect(`${FRONTEND_URL}?code=${code}`);
});

// retrieve id tokens using authorization code
app.get("/exchange-tokens", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("Authorization code is required.");
  }

  try {
    const tokens = await exchangeAuthorizationCodeForTokens(code);
    console.log("Tokens received:", tokens);

    req.session.tokens = tokens;

    res.json({ message: "Token exchange successful", tokens });
  } catch (error) {
    res.status(500).send(error.message);
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy server listening on http://localhost:${PORT}`);
});

