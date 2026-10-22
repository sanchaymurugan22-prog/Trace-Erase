#!/bin/bash
# Starts TraceErase. In Terminal:  cd ~/Documents/TraceErase && bash start.command
# Every run: installs or updates packages, checks the Gemini key (and saves the model it can use), starts the app.
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install the LTS version from https://nodejs.org and run this again."
  read -n 1 -s -r -p "Press any key to close"; exit 1
fi

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "  TraceErase needs Node.js 20 or newer (you have $(node -v)). Install the LTS version from https://nodejs.org and run this again."
  read -n 1 -s -r -p "Press any key to close"; exit 1
fi

if [ ! -f server/.env ]; then cp server/.env.example server/.env; echo "  Created server/.env"; fi
if ! grep -q '^GEMINI_API_KEY=..*' server/.env; then
  echo ""
  echo "  Paste your Gemini API key and press Enter (or just press Enter to run without AI for now):"
  read -r KEY
  if [ -n "$KEY" ]; then
    KEY_ESCAPED=$(printf '%s' "$KEY" | sed 's/[\/&]/\\&/g')
    if grep -q '^GEMINI_API_KEY=' server/.env; then sed -i '' "s/^GEMINI_API_KEY=.*/GEMINI_API_KEY=$KEY_ESCAPED/" server/.env; else echo "GEMINI_API_KEY=$KEY" >> server/.env; fi
    echo "  Saved to server/.env (this file stays on your Mac and is never sent to the browser)."
  fi
fi

echo ""
echo "  Installing / updating packages…"
npm install --no-audit --no-fund || { echo "  npm install failed. Check your internet connection and run this again."; read -n 1 -s -r; exit 1; }

if grep -q '^GEMINI_API_KEY=..*' server/.env; then
  echo ""
  echo "  Checking which Gemini model your key can use…"
  npm run --silent check:ai || true
fi

echo ""
echo "  Starting TraceErase…"
echo "  App:  http://localhost:5173"
echo "  Press Ctrl+C in this window to stop."
echo ""
(sleep 7; open "http://localhost:5173") &
npm run dev
