#!/usr/bin/env python3
"""
Miniverse Admin API - Taylor Client (Python)
For submitting budget reallocations
"""

import requests
import json
import sys
from datetime import datetime

API_URL = "https://YOUR_VERCEL_URL/api/taylor"
API_KEY = "sk_taylor_adde1aa9bb51f519fc8e82d41a56174a7a5f8edc"

def submit_reallocation(message):
    """Submit a budget reallocation request"""

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "message": message
    }

    try:
        print("📊 Submitting budget reallocation...")
        response = requests.post(API_URL, json=payload, headers=headers, timeout=30)

        if response.status_code == 200:
            data = response.json()
            print("\n✅ SUCCESS")
            print(f"Record ID: {data.get('recordId')}")
            print(f"Status: {data.get('message')}")
            print(f"Rate Limit Remaining: {data.get('rateLimit')}/100")
            print(f"\nData Processed:")
            print(json.dumps(data.get('data'), indent=2))
            return True
        elif response.status_code == 429:
            print("\n❌ Rate limit exceeded (100 requests/hour)")
            return False
        elif response.status_code == 401:
            print("\n❌ Invalid API key")
            return False
        else:
            error = response.json()
            print(f"\n❌ ERROR: {error.get('error')}")
            return False

    except requests.exceptions.RequestException as e:
        print(f"\n❌ Connection error: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 client_taylor.py \"Your message here\"")
        print("")
        print("Examples:")
        print("  python3 client_taylor.py \"Move $10000 from creative to digital\"")
        print("  python3 client_taylor.py \"Reallocate $5000 from influencers to search\"")
        sys.exit(1)

    message = " ".join(sys.argv[1:])
    success = submit_reallocation(message)
    sys.exit(0 if success else 1)
