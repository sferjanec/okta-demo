import React, { useState } from "react";

interface Tokens {
  id_token?: string;
  access_token?: string;
  refresh_token?: string;
}

const App = (): React.ReactElement => {
  const [tokens, setTokens] = useState<Tokens | null>(null);

  const handleLogin = () => {
    window.location.href = "http://localhost:3000/login";
  };

  const fetchTokens = async () => {
    try {
      const response = await fetch("http://localhost:3000/tokens", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch tokens");
      }

      const tokenData = await response.json();
      setTokens(tokenData);
    } catch (error) {
      console.error("Error fetching tokens:", error);
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>React OIDC Integration</h1>
      <button onClick={handleLogin}>Login</button>
      <button onClick={fetchTokens}>Fetch Tokens</button>
      {tokens && (
        <pre style={{ textAlign: "left", margin: "20px auto", maxWidth: "600px" }}>
          {JSON.stringify(tokens, null, 2)}
        </pre>
      )}
    </div>
  );
};

export default App;
