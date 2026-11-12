#!/bin/bash
# Make word audio for the flashcard prototype with the macOS `say` voice. Run on the Mac:
#   bash tools/cards_say_audio.sh            # default voice Samantha
#   VOICE="Ava (Premium)" bash tools/cards_say_audio.sh
# Reads cards/audio/words.tsv (number, card id, text) and writes cards/audio/NN.m4a plus manifest.json.
# `say -v '?' | grep en_US` lists the installed US voices. Output is synthetic, unreviewed audio for family use.
set -euo pipefail
cd "$(dirname "$0")/../cards/audio"
VOICE="${VOICE:-Samantha}"
command -v say >/dev/null || { echo "say 명령이 없습니다. macOS에서 실행하세요."; exit 1; }
n=0; printf '{\n "voice": "%s",\n "files": {' "$VOICE" > manifest.json.tmp
while IFS=$'\t' read -r num id text; do
  [ -z "$num" ] && continue
  say -v "$VOICE" -r 160 -o "$num.aiff" "$text"
  afconvert -f m4af -d aac -b 64000 "$num.aiff" "$num.m4a" && rm -f "$num.aiff"
  [ $n -gt 0 ] && printf ',' >> manifest.json.tmp
  printf '\n  "%s": "%s.m4a"' "$id" "$num" >> manifest.json.tmp
  n=$((n+1))
done < words.tsv
printf '\n }\n}\n' >> manifest.json.tmp && mv manifest.json.tmp manifest.json
echo "음원 $n개를 만들었습니다 (음성: $VOICE). 브라우저를 새로고침하세요."
