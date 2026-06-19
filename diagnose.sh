#!/bin/bash
echo "🔍 Diagnostic Tests"
echo ""

echo "1. Checking if server is running..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:20129/dashboard > /dev/null 2>&1; then
    echo "✅ Server is running on port 20129"
else
    echo "❌ Cannot connect to localhost:20129"
    echo "   Make sure Docker is running: docker ps | grep api2k"
    exit 1
fi

echo ""
echo "2. Checking API Key..."
KEY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:20129/api/settings \
  -H "Authorization: Bearer sk-b3a3bc62424af4a4-h4on9e-d3eacac8")
if [ "$KEY_STATUS" = "200" ]; then
    echo "✅ API Key is valid"
else
    echo "❌ API Key invalid (status: $KEY_STATUS)"
fi

echo ""
echo "3. Checking Gemini CLI connections..."
CONN_RES=$(curl -s http://localhost:20129/api/providers/gemini-cli/connections \
  -H "Authorization: Bearer sk-b3a3bc62424af4a4-h4on9e-d3eacac8" 2>/dev/null)
if [ -n "$CONN_RES" ]; then
    ACTIVE=$(echo "$CONN_RES" | grep -o '"status":"active"' | wc -l)
    echo "✅ Gemini CLI: $ACTIVE active connections"
    if [ "$ACTIVE" -eq 0 ]; then
        echo "⚠️  No active connections! Add one at:"
        echo "   http://localhost:20129/dashboard/providers/gemini-cli"
    fi
else
    echo "❌ Cannot check connections"
fi

echo ""
echo "4. Simple chat test..."
echo "   Sending request to /v1/chat/completions..."
RESPONSE=$(curl -s -X POST http://localhost:20129/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-b3a3bc62424af4a4-h4on9e-d3eacac8" \
  -d '{"model":"gemini-3-flash-preview","messages":[{"role":"user","content":"Hi"}],"stream":false}' \
  -w "\nHTTP_CODE:%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE:/d')

echo "   HTTP Status: $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ]; then
    echo "   Response body (first 200 chars):"
    echo "$BODY" | head -c 200
    echo ""
    
    # Try to parse usage
    USAGE=$(echo "$BODY" | grep -o '"usage":{[^}]*}' || echo "not found")
    if [ "$USAGE" != "not found" ]; then
        echo ""
        echo "✅ Found usage in response: $USAGE"
    else
        echo ""
        echo "❌ No usage field in response"
    fi
else
    echo "   Error response: $BODY"
fi

echo ""
echo "💡 Check Docker logs for more info:"
echo "   docker logs api2k | tail -50"
