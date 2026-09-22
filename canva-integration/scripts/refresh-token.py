import json
import urllib.request
import urllib.error
import urllib.parse
import os
import time

TOKEN_FILE = r"D:\saas-hub\canva-integration\server\.canva-tokens.json"
CLIENT_ID = "TU CLIENTE ID AQUI"
CLIENT_SECRET = "TU CLIENTE SECRET AQUI"

try:
    with open(TOKEN_FILE, "r") as f:
        tokens = json.load(f)
    refresh_token = tokens["refreshToken"]
    print("Found refresh token.")
except Exception as e:
    print(f"Error reading refresh token: {e}")
    exit(1)

url = "https://api.canva.com/rest/v1/oauth/token"
headers = {
    "Content-Type": "application/x-www-form-urlencoded"
}
data = urllib.parse.urlencode({
    "grant_type": "refresh_token",
    "refresh_token": refresh_token,
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET
}).encode("utf-8")

req = urllib.request.Request(url, data=data, headers=headers, method="POST")

try:
    print("Sending refresh token request to Canva...")
    with urllib.request.urlopen(req) as resp:
        body = resp.read().decode("utf-8")
        res_json = json.loads(body)
        print("Success! Received new tokens.")
        
        new_access_token = res_json["access_token"]
        # Canva might return a new refresh token, or we keep the old one
        new_refresh_token = res_json.get("refresh_token", refresh_token)
        expires_in = res_json["expires_in"]
        
        now_ms = time.time() * 1000
        saved = {
            "accessToken": new_access_token,
            "refreshToken": new_refresh_token,
            "expiresAt": now_ms + expires_in * 1000
        }
        
        with open(TOKEN_FILE, "w") as f:
            json.dump(saved, f, indent=2)
        print(f"Updated tokens written to {TOKEN_FILE}.")
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}: {e.reason}")
    print(e.read().decode("utf-8"))
except Exception as e:
    print(f"Error: {e}")
