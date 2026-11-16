#!/bin/bash
# Off-site copy of the children's records: copies the state folder into a clone of a PRIVATE git repository,
# commits and pushes it. Run it on the Mac that runs tools/serve_cards.py, by hand or once a day (docs/DATA_SAFETY.md).
#
#   bash tools/backup_state.sh /path/to/clone-of-your-private-repo
#   CARDS_BACKUP_REPO=/path/to/clone bash tools/backup_state.sh        # same, for a scheduled job
#   CARDS_STATE_DIR=/other/state-cards bash tools/backup_state.sh ...  # when the server uses another state folder
#
# The records hold the children's names and progress: the target must be a private repository. This game's own
# repository is public, so the script refuses to use it. Nothing is ever deleted from the backup: files are only added
# or updated, and git keeps every earlier version.
# The result (time, success, commit) is written to <state>/offsite.json; the parent screen shows it.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
STATE="${CARDS_STATE_DIR:-$HERE/../state-cards}"
DEST="${1:-${CARDS_BACKUP_REPO:-}}"
note() { # ok(true|false) message commit
  mkdir -p "$STATE" && printf '{"at":"%s","ok":%s,"note":"%s","commit":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2" "${3:-}" > "$STATE/offsite.json.tmp" && mv "$STATE/offsite.json.tmp" "$STATE/offsite.json"
}
fail() { echo "백업 실패: $1" >&2; note false "$1"; exit 1; }

[ -n "$DEST" ] || { echo "사용법: bash tools/backup_state.sh <비공개 저장소를 받아 둔 폴더>" >&2; exit 2; }
[ -d "$STATE" ] || fail "기록 폴더가 없습니다: $STATE"
[ -d "$DEST/.git" ] || fail "git 저장소가 아닙니다: $DEST (비공개 저장소를 먼저 git clone 하세요)"
GAME="$(cd "$HERE/.." && git rev-parse --show-toplevel 2>/dev/null || true)"
TARGET="$(cd "$DEST" && git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$TARGET" ] || fail "git 저장소를 읽을 수 없습니다: $DEST"
[ "$TARGET" != "$GAME" ] || fail "게임 저장소(공개)에는 기록을 올리지 않습니다. 별도의 비공개 저장소를 쓰세요"

mkdir -p "$DEST/state-cards/daily" || fail "폴더를 만들 수 없습니다"
found=0
for f in "$STATE"/*.json; do
  [ -e "$f" ] || continue
  case "$(basename "$f")" in offsite.json) continue ;; esac
  cp "$f" "$DEST/state-cards/" || fail "복사 실패: $f"; found=1
done
[ "$found" = 1 ] || fail "올릴 기록이 아직 없습니다"
if [ -d "$STATE/daily" ]; then for f in "$STATE"/daily/*.json; do [ -e "$f" ] && { cp "$f" "$DEST/state-cards/daily/" || fail "복사 실패: $f"; }; done; fi

cd "$DEST" || fail "폴더에 들어갈 수 없습니다"
git add -A state-cards || fail "git add 실패"
if git diff --cached --quiet; then
  git push -q 2>/dev/null || true                     # nothing new; still try to deliver earlier commits
  note true "변경 없음" "$(git rev-parse --short HEAD 2>/dev/null || true)"; echo "백업: 바뀐 것이 없습니다."; exit 0
fi
git commit -q -m "기록 백업 $(date '+%Y-%m-%d %H:%M')" || fail "git commit 실패"
git push -q || fail "git push 실패 (네트워크나 인증을 확인하세요. 기록은 이 Mac의 백업 폴더에 커밋되어 있습니다)"
note true "올림" "$(git rev-parse --short HEAD)"
echo "백업 완료: $(git rev-parse --short HEAD)"
