#!/bin/bash

# Miniverse Admin API - Cherly Client (Bash/cURL)
# For submitting media spend updates

API_URL="https://YOUR_VERCEL_URL/api/cherly"
API_KEY="sk_cherly_44ed9aab3565d9cb57a4494d36001a5c3fc23c23"

# Check if message provided
if [ -z "$1" ]; then
  echo "Usage: ./client_cherly.sh \"Your message here\""
  echo ""
  echo "Examples:"
  echo "  ./client_cherly.sh \"Spent $5000 on LinkedIn ads from vendor ABC\""
  echo "  ./client_cherly.sh \"Influencer campaign $3000 on paid media, PO 2027-001\""
  exit 1
fi

MESSAGE="$1"

# Make the API request
echo "Submitting media spend update..."
curl -X POST "$API_URL" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"$MESSAGE\"}" \
  -s | jq .

echo ""
echo "✓ Request sent!"
