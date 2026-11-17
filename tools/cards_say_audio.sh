#!/bin/bash
# Make word audio for the cards game with the macOS `say` voice. Run on the Mac:
#   bash tools/cards_say_audio.sh                 # every card (4,610), default voice Samantha; takes a while
#   LIMIT=300 bash tools/cards_say_audio.sh       # only the first 300 cards in world order (about the first two worlds)
#   VOICE="Ava (Premium)" bash tools/cards_say_audio.sh
# Reads cards/audio/words.tsv (number, card id, text; written by tools/make_cards_data.py in the order the worlds meet
# the cards) and writes cards/audio/NNNN.m4a plus manifest.json. A file that already exists is kept, so the script can
# be stopped and run again, and a larger LIMIT later only adds the missing files. To change the voice, move the old
# .m4a files away first. `say -v '?' | grep en_US` lists the installed US voices.
# Then reads cards/audio/forms.tsv (number, form id, text: the word forms of the whirlwind cards, also written by
# tools/make_cards_data.py) the same way and writes fNNN.m4a. LIMIT applies to the cards only; every form is made.
# Output is synthetic, unreviewed audio for family use.
set -euo pipefail
cd "$(dirname "$0")/../cards/audio"
VOICE="${VOICE:-Samantha}"; LIMIT="${LIMIT:-0}"
command -v say >/dev/null || { echo "say 명령이 없습니다. macOS에서 실행하세요."; exit 1; }
n=0; made=0; printf '{\n "voice": "%s",\n "files": {' "$VOICE" > manifest.json.tmp
# one list: file number, id, text per line. $2 = how many lines to read at most (0 = all)
make_list() {
  local list="$1" limit="$2" k=0
  while IFS=$'\t' read -r num id text; do
    [ -z "$num" ] && continue
    if [ "$limit" -gt 0 ] && [ "$k" -ge "$limit" ]; then break; fi
    if [ ! -s "$num.m4a" ]; then
      say -v "$VOICE" -r 160 -o "$num.aiff" "$text"
      afconvert -f m4af -d aac -b 64000 "$num.aiff" "$num.m4a" && rm -f "$num.aiff"
      made=$((made+1)); [ $((made % 100)) -eq 0 ] && echo "… $made개 생성"
    fi
    [ $n -gt 0 ] && printf ',' >> manifest.json.tmp
    printf '\n  "%s": "%s.m4a"' "$id" "$num" >> manifest.json.tmp
    n=$((n+1)); k=$((k+1))
  done < "$list"
}
make_list words.tsv "$LIMIT"
if [ -f forms.tsv ]; then make_list forms.tsv 0; fi
printf '\n }\n}\n' >> manifest.json.tmp && mv manifest.json.tmp manifest.json
echo "음원 목록 $n개 (새로 만든 것 $made개, 음성: $VOICE). 브라우저를 새로고침하세요."
