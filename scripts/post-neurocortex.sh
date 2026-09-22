#!/usr/bin/env bash
# Post completo para NeuroCortex: caption (Gemini) + imagen (ComfyUI) + publicar + verificar.
# Uso: bash scripts/post-neurocortex.sh "tema del post" [ancho] [alto]
# Requiere: hub corriendo en :3000 y ComfyUI en :8188 (ver skill saas-hub-publishing).
set -euo pipefail

HUB="http://127.0.0.1:3000"
COMFY="http://127.0.0.1:8188"
COMFY_OUT="/d/ComfyUI Portable/ComfyUI/output"
PAGE_ID="1013639518488775"
GEN="z-image-turbo"
LLM_MODEL="gemini-3.6-flash"
THEMA="${1:-soluciones de software y hardware para empresas}"
W="${2:-1080}"
H="${3:-1080}"

jq() { python -c "import json,sys; d=json.load(sys.stdin); print(eval(sys.argv[1]))" "$1"; }

echo "== 1/4 Caption (Gemini $LLM_MODEL) =="
# El caption lo genera Gemini usando la voz de marca de NeuroCortex.
CAPTION=$(curl -sf -X POST "$HUB/api/generate-caption" --max-time 120 -H "Content-Type: application/json" -d "{
  \"brandName\": \"NeuroCortex\",
  \"voiceTone\": \"corporativo con toque de innovación\",
  \"platforms\": [\"facebook\"],
  \"idea\": \"$THEMA\",
  \"llmSettings\": {\"model\": \"$LLM_MODEL\"}
}" | python -c "import json,sys; print(json.load(sys.stdin)['caption'])")
echo "$CAPTION"
echo

echo "== 2/4 Imagen (ComfyUI $GEN) =="
# El prompt visual usa los colores de marca (#3498db, #2ecc71) sobre fondo oscuro.
IMG_PROMPT="Minimalist futuristic corporate tech visual for a software and hardware company: glowing network nodes connected by thin neon lines in blue (#3498db) and green (#2ecc71) on a dark background, modern cyberpunk aesthetic, subtle neon glow, high-end enterprise marketing poster style, clean composition with negative space, no text. Theme: $THEMA"
LAST_IMG=""
for f in $(ls -t "$COMFY_OUT"/saas_hub_*.png 2>/dev/null | head -1); do LAST_IMG="$f"; done
NEW_IMG=$(curl -sf -X POST "$HUB/api/generate-image" --max-time 590 -H "Content-Type: application/json" -d "{
  \"prompt\": \"$IMG_PROMPT\",
  \"negativePrompt\": \"text, words, letters, watermark, logo, low quality, blurry, cluttered, cartoon\",
  \"generator\": \"$GEN\",
  \"width\": $W,
  \"height\": $H
}" 2>/dev/null | python -c "import json,sys
d=json.load(sys.stdin)
print(d.get('imagePath') or d.get('outputFile') or '')" || true)
if [ -z "$NEW_IMG" ] || [ ! -f "$NEW_IMG" ]; then
  # El endpoint a veces no devuelve la ruta: tomar la más nueva de output/
  NEW_IMG=$(ls -t "$COMFY_OUT"/saas_hub_*.png 2>/dev/null | head -1)
fi
if [ -z "$NEW_IMG" ] || [ "$NEW_IMG" = "$LAST_IMG" ]; then
  echo "ERROR: no se generó imagen nueva. VRAM? ComfyUI?" >&2
  exit 1
fi
echo "Imagen: $NEW_IMG"
echo

echo "== 3/4 Publicar (texto + imagen) =="
B64=$(python -c "import base64,sys; print(base64.b64encode(open(sys.argv[1],'rb').read()).decode())" "$NEW_IMG")
RESP=$(curl -sf -X POST "$HUB/api/publish-with-image" --max-time 60 -H "Content-Type: application/json" -d "{
  \"pageId\": \"$PAGE_ID\",
  \"message\": $(python -c "import json,sys; print(json.dumps(sys.argv[1]))" "$CAPTION"),
  \"image\": \"data:image/png;base64,$B64\"
}")
POST_ID=$(echo "$RESP" | python -c "import json,sys; print(json.load(sys.stdin)['postId'])")
PERMALINK=$(echo "$RESP" | python -c "import json,sys; print(json.load(sys.stdin).get('permalink',''))")
echo "postId: $POST_ID"
echo "permalink: $PERMALINK"
echo

echo "== 4/4 Verificar (leer post de vuelta) =="
TOKEN=$(grep "^FACEBOOK_TOKEN_NEUROCORTEX=" "$(dirname "$0")/../.env.local" | cut -d= -f2)
curl -sf "https://graph.facebook.com/v23.0/${PAGE_ID}_${POST_ID}?fields=message,created_time&access_token=$TOKEN" --max-time 15 | python -c "import json,sys; d=json.load(sys.stdin); print('OK - publicado'); print('texto:', d.get('message','')[:120]); print('fecha:', d.get('created_time',''))"
echo
echo "LISTO: $PERMALINK"
