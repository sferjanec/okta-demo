import { useState, useEffect } from "react";


const App = () => {
  const [tokens, setTokens] = useState(null);
  const [loginMessage, setLoginMessage] = useState("");

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

  useEffect(() => {
    // Check the URL for a successful login
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get("success");
    const code = urlParams.get("code");

    if (success || code) {
      setLoginMessage("Login successful! You can now fetch your tokens.");
      
      // Optionally clear the query parameters from the URL
      window.history.replaceState({}, document.title, "/");
    }
  }, []);

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>React OIDC Integration</h1>

      {loginMessage && <p style={{ color: "green", fontWeight: "bold" }}>{loginMessage}</p>}

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
