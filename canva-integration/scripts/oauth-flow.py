#!/usr/bin/env python3
import os, base64, hashlib, json, http.server, urllib.request, urllib.parse, threading, time, sys

CANVA_CLIENT_ID = os.environ.get('CANVA_CLIENT_ID', 'OC-AZ8JClBbUrTr')
CANVA_CLIENT_SECRET = os.environ.get('CANVA_CLIENT_SECRET', '')
CANVA_REDIRECT_URI = 'http://localhost:8001/auth/callback'
TOKEN_FILE = os.environ.get('CANVA_TOKEN_FILE', 'D:\\saas-hub\\canva-integration\\server\\.canva-tokens.json')

if not CANVA_CLIENT_SECRET:
    print("ERROR: Set CANVA_CLIENT_SECRET environment variable")
    sys.exit(1)

# Step 1: Generate PKCE
code_verifier = base64.urlsafe_b64encode(os.urandom(96)).rstrip(b'=').decode('ascii')
code_challenge = base64.urlsafe_b64encode(hashlib.sha256(code_verifier.encode('ascii')).digest()).rstrip(b'=').decode('ascii')
state = os.urandom(16).hex()

# Step 2: Build OAuth URL (Canva-compatible encoding)
def encode_val(v):
    return urllib.parse.quote(v, safe='')

params = [
    ('code_challenge_method', 's256'),
    ('response_type', 'code'),
    ('client_id', CANVA_CLIENT_ID),
    ('redirect_uri', CANVA_REDIRECT_URI),
    ('scope', 'asset:read asset:write design:content:read design:content:write design:meta:read brandtemplate:meta:read autofill:write comment:read comment:write folder:read folder:write profile:read'),
    ('code_challenge', code_challenge),
    ('state', state),
]
auth_url = 'https://www.canva.com/api/oauth/authorize?' + '&'.join(f'{k}={encode_val(v)}' for k, v in params)

print("=" * 70)
print("ABRE ESTA URL EN TU NAVEGADOR:")
print("=" * 70)
print(auth_url)
print()
print("DESPUES DE AUTORIZAR, ESPERA AQUI...")
print()

# Step 3: Start callback server
received_code = [None]
received_state = [None]
event = threading.Event()

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        
        if parsed.path == '/auth/callback':
            code = qs.get('code', [None])[0]
            st = qs.get('state', [None])[0]
            err = qs.get('error', [None])[0]
            
            if err:
                self.send_response(400)
                self.send_header('Content-type', 'text/html; charset=utf-8')
                self.end_headers()
                msg = f'<html><body><h1>Error: {err}</h1><p>{qs.get("error_description", [""])[0]}</p></body></html>'
                self.wfile.write(msg.encode())
                return
            
            if code and st:
                received_code[0] = code
                received_state[0] = st
                self.send_response(200)
                self.send_header('Content-type', 'text/html; charset=utf-8')
                self.end_headers()
                self.wfile.write(b'<html><body><h1>Autenticacion exitosa!</h1><p>Ya podes cerrar esta ventana.</p><script>setTimeout(()=>window.close(),2000)</script></body></html>')
                event.set()
            else:
                self.send_response(400)
                self.send_header('Content-type', 'text/html; charset=utf-8')
                self.end_headers()
                self.wfile.write(b'<html><body><h1>Error: Faltan parametros</h1></body></html>')
        else:
            self.send_response(404)
            self.end_headers()
    
    def log_message(self, format, *args):
        pass

print("Iniciando servidor de callback en http://127.0.0.1:8001/auth/callback ...")
server = http.server.HTTPServer(('127.0.0.1', 8001), Handler)
server_thread = threading.Thread(target=server.serve_forever, daemon=True)
server_thread.start()

# Wait for callback (max 5 min)
if not event.wait(timeout=300):
    print("Timeout esperando callback - el enlace expiro")
    server.shutdown()
    sys.exit(1)

server.shutdown()

# Step 4: Verify state
if received_state[0] != state:
    print(f"ERROR: State mismatch - posible CSRF")
    sys.exit(1)

print("Codigo de autorizacion recibido correctamente")
print("Intercambiando por token de acceso...")

# Step 5: Exchange code for tokens
token_url = "https://api.canva.com/rest/v1/oauth/token"
credentials = f"{CANVA_CLIENT_ID}:{CANVA_CLIENT_SECRET}"
auth_header = base64.b64encode(credentials.encode()).decode()

token_data = urllib.parse.urlencode({
    'grant_type': 'authorization_code',
    'code': received_code[0],
    'code_verifier': code_verifier,
}).encode()

req = urllib.request.Request(token_url, data=token_data)
req.add_header('Authorization', f'Basic {auth_header}')
req.add_header('Content-Type', 'application/x-www-form-urlencoded')

try:
    resp = urllib.request.urlopen(req)
    tokens = json.loads(resp.read())
    print(f"Access token obtenido! Expira en: {tokens.get('expires_in', '?')} segundos")
    
    now_ms = time.time() * 1000
    saved = {
        'accessToken': tokens['access_token'],
        'refreshToken': tokens['refresh_token'],
        'expiresAt': now_ms + tokens['expires_in'] * 1000,
    }
    
    os.makedirs(os.path.dirname(TOKEN_FILE), exist_ok=True)
    with open(TOKEN_FILE, 'w') as f:
        json.dump(saved, f)
    
    print(f"Tokens guardados en {TOKEN_FILE}")
    print()
    print("=" * 70)
    print("AUTENTICACION EXITOSA!")
    print("Ahora reiniciemos el servidor MCP")
    print("=" * 70)
    
except urllib.error.HTTPError as e:
    print(f"ERROR HTTP: {e.code} {e.reason}")
    error_body = e.read().decode()
    print(error_body)
    sys.exit(1)
