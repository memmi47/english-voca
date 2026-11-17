#!/bin/bash
# Off-site copy of the children's records: copies the state folder into a clone of a PRIVATE git repository,
# commits and pushes it. Run it on the Mac that runs tools/serve_cards.py, by hand or once a day (docs/DATA_SAFETY.md).
#
#   bash tools/backup_state.sh /path/to/clone-of-your-private-repo
#   CARDS_BACKUP_REPO=/path/to/clone bash tools/backup_state.sh        # same, for a scheduled job
#   CARDS_STATE_DIR=/other/state-cards bash tools/backup_state.sh ...  # when the server uses another state folder
#
# The records hold the children's names and progress: the target must be a private repository. This game's own
# repository is public, so the script refuses to use it. Before anything is copied, the place `origin` pushes to is
# checked: a GitHub repository is asked about without signing in (public answers 200: refused; private looks missing,
# 404: used; no answer or anything else: refused, it cannot be checked); a folder on this Mac (a bare repository on another
# disk) is used; any other host is refused.
#   CARDS_BACKUP_ASSUME_PRIVATE=1   skip that check (the parent has looked at the repository settings)
#   CARDS_BACKUP_TEST_HTTP=404      the answer to use instead of asking GitHub (tests; no network)
# Nothing is ever deleted from the backup: files are only added or updated, and git keeps every earlier version.
# Success is recorded only when the push went through, also when nothing changed (an earlier commit may still be waiting).
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
# Where `git push origin` really sends: every push URL of origin, with insteadOf / pushInsteadOf rewriting applied
# (C-007 R4). All of them are checked before anything is copied; the push below names origin and the branch explicitly,
# so branch.*.pushRemote and remote.origin.push cannot send it elsewhere.
BRANCH="$(cd "$DEST" && git symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
[ -n "$BRANCH" ] || fail "백업 저장소가 브랜치에 있지 않습니다(detached HEAD): $DEST"
URLS="$(cd "$DEST" && git remote get-url --push --all origin 2>/dev/null || true)"
[ -n "$URLS" ] || fail "올릴 곳(origin)이 설정되지 않았습니다: $DEST"
# The addresses as written in the config too (before rewriting): both lists must pass the check.
RAW="$(cd "$DEST" && { git config --get-all remote.origin.pushurl || git config --get-all remote.origin.url; } 2>/dev/null || true)"
check_url() {
  local URL="$1" PLACE REPO CODE
  case "$URL" in
    file://*|/*|./*|../*) PLACE=local ;;
    *:*) PLACE=remote ;;                                 # https://host/..., ssh://..., or user@host:path
    *) PLACE=local ;;                                    # a relative path
  esac
  [ "$PLACE" = remote ] || return 0
  REPO="$(printf '%s\n' "$URL" | sed -n -E 's#^(https?://([^@/]+@)?github\.com/|ssh://([^@/]+@)?github\.com/|([^@/:]+@)?github\.com:)([^/]+)/([^/]+)$#\5/\6#p' | sed -E 's#\.git$##')"
  [ -n "$REPO" ] || fail "GitHub 저장소나 이 Mac의 폴더가 아닌 곳에는 올리지 않습니다: $URL"
  CODE="${CARDS_BACKUP_TEST_HTTP:-}"
  if [ -z "$CODE" ]; then CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "https://api.github.com/repos/$REPO" 2>/dev/null)" || true; fi
  case "$CODE" in
    404) ;;                                              # not visible without signing in: private
    200) fail "공개 저장소에는 기록을 올리지 않습니다: $REPO (GitHub에서 Private으로 바꾸거나 비공개 저장소를 쓰세요)" ;;
    *) fail "저장소가 비공개인지 확인할 수 없습니다: $REPO (응답 ${CODE:-없음}). 직접 확인했다면 CARDS_BACKUP_ASSUME_PRIVATE=1 로 실행하세요" ;;
  esac
}
if [ "${CARDS_BACKUP_ASSUME_PRIVATE:-}" != 1 ]; then
  while IFS= read -r U; do [ -n "$U" ] && check_url "$U"; done <<EOF_URLS
$RAW
$URLS
EOF_URLS
fi

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
# Sends HEAD to origin's branch by name, then asks every push URL whether that branch now points at HEAD (C-007 R3).
push_checked() {
  local HEADC U GOT
  HEADC="$(git rev-parse HEAD)" || return 1
  git push -q origin "HEAD:refs/heads/$BRANCH" || return 1
  while IFS= read -r U; do
    [ -n "$U" ] || continue
    GOT="$(git ls-remote "$U" "refs/heads/$BRANCH" 2>/dev/null | cut -f1)"
    [ "$GOT" = "$HEADC" ] || { echo "올린 곳에서 백업 커밋을 확인하지 못했습니다: $U" >&2; return 1; }
  done <<EOF_URLS
$URLS
EOF_URLS
}
git add -A state-cards || fail "git add 실패"
if git diff --cached --quiet; then
  push_checked || fail "git push 실패 (바뀐 것은 없지만 이전 백업이 아직 올라가지 않았습니다. 네트워크나 인증을 확인하세요)"   # nothing new; earlier commits must still arrive
  note true "변경 없음" "$(git rev-parse --short HEAD 2>/dev/null || true)"; echo "백업: 바뀐 것이 없습니다."; exit 0
fi
git commit -q -m "기록 백업 $(date '+%Y-%m-%d %H:%M')" || fail "git commit 실패"
push_checked || fail "git push 실패 또는 확인 실패 (네트워크나 인증을 확인하세요. 기록은 이 Mac의 백업 폴더에 커밋되어 있습니다)"
note true "올림" "$(git rev-parse --short HEAD)"
echo "백업 완료: $(git rev-parse --short HEAD)"
