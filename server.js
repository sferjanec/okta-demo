const express = require("express");
const session = require("express-session");
const axios = require("axios");
const dotenv = require("dotenv");
const crypto = require("crypto");
const proxy = require("express-http-proxy");
const cors = require("cors");

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

// allow cors request from localhost
app.use(
  cors({
    origin: "http://localhost:4300", // Replace with your React app's URL
    credentials: true, // Allow cookies and credentials to be sent
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

  const authUrl = `${ISSUER_URI}/v1/authorize?` +
    new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: "openid profile email",
      state: state,
      nonce: nonce,
    }).toString();

  console.log("Redirecting to authorization URL:", authUrl);

  res.redirect(authUrl); // Redirect the user to Okta's `/authorize`
});

app.get("/callback", async (req, res) => {
  const { code, state } = req.query;

  console.log("Authorization Code Received:", code);
  console.log("State Received:", state);

  // Validate the state parameter
  if (state !== req.session.state) {
    return res.status(400).send("Invalid state parameter.");
  }

  try {
    // Exchange the authorization code for tokens
    const tokenResponse = await fetch(`${ISSUER_URI}/v1/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: "http://localhost:3000/callback",
        code: code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token Exchange Failed:", errorData);
      return res.status(500).send("Failed to exchange authorization code.");
    }

    const tokenData = await tokenResponse.json();
    console.log("Token Response:", tokenData);

    // Store tokens in the session
    req.session.tokens = tokenData;

    // Redirect back to the frontend
    res.redirect(FRONTEND_URL);
  } catch (error) {
    console.error("Error during token exchange:", error.message);
    res.status(500).send("An unexpected error occurred.");
  }
});


// *** currently not functional ****
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

app.get("/callback", async (req, res) => {
  const { code, state } = req.query;

  console.log("Authorization Code Received:", code);
  console.log("State Received:", state);

  // Validate the state parameter
  if (state !== req.session.state) {
    return res.status(400).send("Invalid state parameter.");
  }

  try {
    // Exchange the authorization code for tokens
    const tokenResponse = await fetch(`${ISSUER_URI}/v1/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: "http://localhost:3000/callback",
        code: code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token Exchange Failed:", errorData);
      return res.status(500).send("Failed to exchange authorization code.");
    }

    const tokenData = await tokenResponse.json();
    console.log("Token Response:", tokenData);

    // Store tokens in the session
    req.session.tokens = tokenData;

    // Redirect back to the frontend
    res.redirect("http://localhost:4300");
  } catch (error) {
    console.error("Error during token exchange:", error.message);
    res.status(500).send("An unexpected error occurred.");
  }
});

app.get("/tokens", (req, res) => {
  if (!req.session.tokens) {
    return res.status(401).send("No tokens available. Please log in.");
  }

  // Send tokens to the client
  res.json({
    access_token: req.session.tokens.access_token,
    id_token: req.session.tokens.id_token,
    expires_in: req.session.tokens.expires_in,
  });
});


// app.get("/tokens", async (req, res) => {
//   const { authCode } = req.session;

//   if (!authCode) {
//     return res.status(400).send("Authorization code is missing or expired.");
//   }

//   try {
     // Exchange the authorization code for tokens
//     const tokenResponse = await fetch(`${ISSUER_URI}/v1/token`, {
//       method: "POST",
//       headers: { "Content-Type": "application/x-www-form-urlencoded" },
//       body: new URLSearchParams({
//         grant_type: "authorization_code",
//         client_id: CLIENT_ID,
//         client_secret: CLIENT_SECRET,
//         redirect_uri: REDIRECT_URI,
//         code: authCode,
//       }),
//     });

//     if (!tokenResponse.ok) {
//       const errorData = await tokenResponse.text();
//       console.error("Token Exchange Failed:", errorData);
//       return res.status(500).send("Failed to exchange authorization code.");
//     }

//     const tokenData = await tokenResponse.json();
//     console.log("Token Response:", tokenData);

//     // Clear the authorization code from the session
//     req.session.authCode = null;

//     // Return tokens to the client
//     res.json({
//       access_token: tokenData.access_token,
//       id_token: tokenData.id_token,
//       expires_in: tokenData.expires_in,
//     });
//   } catch (error) {
//     console.error("Error during token exchange:", error.message);
//     res.status(500).send("An unexpected error occurred.");
//   }
// });


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy server listening on http://localhost:${PORT}`);
});

