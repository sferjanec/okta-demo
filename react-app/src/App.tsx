import React, { useEffect, useState } from "react";

interface Tokens {
  id_token?: string;
  access_token?: string;
  refresh_token?: string;
}

const App = (): React.ReactElement => {
  const [authCode, setAuthCode] = useState<string | null>(null);
  const [tokens, setTokens] = useState<Tokens | null>(null);

  // Extract the authorization code from the URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    if (code) {
      setAuthCode(code);
    }
  }, []);

  // Handle login to redirect to the proxy's /login endpoint
  const handleLogin = () => {
    window.location.href = "http://localhost:3000/login";
  };

  // Handle token exchange by calling the proxy's /exchange-tokens endpoint
  const handleExchangeTokens = async () => {
    if (!authCode) {
      alert("No authorization code found. Please log in first.");
      return;
    }

    try {
      const response = await fetch(`http://localhost:3000/exchange-tokens?code=${authCode}`);
      if (!response.ok) {
        throw new Error("Failed to exchange tokens");
      }
      const data: Tokens = await response.json();
      setTokens(data);
    } catch (error) {
      console.error("Error exchanging tokens:", error);
      alert("Failed to exchange tokens. Check the console for details.");
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>OIDC Login Demo</h1>

      {!authCode ? (
        <>
          <p>Click the button below to log in:</p>
          <button onClick={handleLogin}>Login with OIDC Proxy</button>
        </>
      ) : (
        <>
          <h2>Step 1: Authorization Code Received</h2>
          <p>Your Authorization Code:</p>
          <code>{authCode}</code>
          <br />
          <button onClick={handleExchangeTokens} style={{ marginTop: "20px" }}>
            Exchange Tokens
          </button>
        </>
      )}

      {tokens && (
        <>
          <h2>Step 2: Tokens Received</h2>
          <pre style={{ textAlign: "left", margin: "20px auto", maxWidth: "600px" }}>
            {JSON.stringify(tokens, null, 2)}
          </pre>
        </>
      )}
    </div>
  );
};

export default App;
