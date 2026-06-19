// Quick diagnostic test
const API_URL = "http://localhost:20129/v1/chat/completions";
const API_KEY = "sk-b3a3bc62424af4a4-h4on9e-d3eacac8";

async function diagnose() {
  console.log("🔍 Diagnostic Tests\n");
  
  // Test 1: Check if server is up
  try {
    const res = await fetch("http://localhost:20129/api/settings", { 
      method: "GET",
      headers: { "Authorization": `Bearer ${API_KEY}` }
    });
    console.log("✅ Server is running (status:", res.status, ")");
  } catch (e) {
    console.log("❌ Cannot connect to localhost:20129");
    console.log("   Error:", e.message);
    console.log("\n💡 Make sure Docker is running:");
    console.log("   docker ps | findstr api2k");
    return;
  }

  // Test 2: Check if key is valid
  try {
    const res = await fetch("http://localhost:20129/api/keys", {
      headers: { "Authorization": `Bearer ${API_KEY}` }
    });
    if (res.ok) {
      console.log("✅ API Key is valid");
    } else {
      console.log("❌ API Key invalid (status:", res.status, ")");
    }
  } catch (e) {
    console.log("❌ Cannot verify API key");
  }

  // Test 3: Check Gemini CLI connection
  try {
    const res = await fetch("http://localhost:20129/api/providers/gemini-cli/connections", {
      headers: { "Authorization": `Bearer ${API_KEY}` }
    });
    if (res.ok) {
      const data = await res.json();
      const active = data.filter(c => c.status === "active").length;
      console.log(`✅ Gemini CLI: ${active} active connections`);
      if (active === 0) {
        console.log("   ⚠️ No active Gemini CLI connections!");
        console.log("   Go to: http://localhost:20129/dashboard/providers/gemini-cli");
      }
    }
  } catch (e) {
    console.log("❌ Cannot check Gemini CLI connections");
  }

  // Test 4: Simple chat test with full debug
  console.log("\n🧪 Simple Chat Test...");
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "gemini-3-flash-preview",
        messages: [{ role: "user", content: "Hi" }],
        stream: false
      })
    });
    
    console.log("Response status:", res.status);
    console.log("Response headers:", Object.fromEntries(res.headers.entries()));
    
    const text = await res.text();
    console.log("Response body (first 500 chars):", text.slice(0, 500));
    
    try {
      const data = JSON.parse(text);
      console.log("\nParsed response:");
      console.log("  model:", data.model);
      console.log("  content:", data.choices?.[0]?.message?.content?.slice(0, 50));
      console.log("  usage:", data.usage);
    } catch (e) {
      console.log("❌ Response is not valid JSON");
    }
  } catch (e) {
    console.log("❌ Request failed:", e.message);
  }
}

diagnose();
