#!/bin/bash
# Add the daily off-site backup (21:07) to a Mac install made without --backup-repo. It adds one user LaunchAgent and
# changes nothing else: the server, its settings and every record stay as they are. Python handles paths and XML.
#   bash tools/backup_add_mac.sh --backup-repo ~/english-voca-state --dry-run
#   bash tools/backup_add_mac.sh --backup-repo ~/english-voca-state --now      (asks y, adds the agent, backs up once now)
# The backup itself is tools/backup_state.sh (private repository check, copy, commit, push; docs/DATA_SAFETY.md).
set -euo pipefail
exec 3<&0
exec python3 - "$0" "$@" <<'PY'
import argparse, os, pathlib, plistlib, subprocess, sys

root = pathlib.Path(sys.argv[1]).resolve().parent.parent
parser = argparse.ArgumentParser(description='이미 설치된 Mac 서버에 매일 21:07 외부 백업만 추가')
parser.add_argument('--backup-repo', required=True, help='별도로 git clone 해 둔 비공개 저장소 폴더')
parser.add_argument('--now', action='store_true', help='추가한 뒤 한 번 바로 백업')
parser.add_argument('--dry-run', action='store_true')
args = parser.parse_args(sys.argv[2:])
home = pathlib.Path.home().resolve()
agents = (home / 'Library/LaunchAgents').resolve(); logs = (home / 'Library/Logs').resolve()
server_plist = agents / 'com.english-voca.server.plist'; backup_plist = agents / 'com.english-voca.backup.plist'

def fail(message): raise SystemExit('백업 추가 중단: ' + message)
def overlaps(a, b): return a == b or a in b.parents or b in a.parents

if server_plist.is_symlink() or not server_plist.exists(): fail('설치된 서버 설정이 없습니다. 먼저 tools/install_mac.sh로 설치하세요')
try: config = plistlib.loads(server_plist.read_bytes())
except (OSError, ValueError, plistlib.InvalidFileException): fail('서버 설정을 읽을 수 없습니다')
program = config.get('ProgramArguments', [])
if config.get('Label') != 'com.english-voca.server' or config.get('WorkingDirectory') != str(root) or str(root / 'tools/serve_cards.py') not in program:
    fail('이 게임 폴더의 서버 설정이 아닙니다')
try: data = pathlib.Path(program[program.index('--state-dir') + 1]).expanduser().resolve()
except (ValueError, IndexError, TypeError): fail('서버 설정의 기록 폴더를 읽을 수 없습니다')
backup = pathlib.Path(args.backup_repo).expanduser().resolve()
if not (backup / '.git').is_dir(): fail('별도로 git clone 한 비공개 저장소가 필요합니다: ' + str(backup))
for other in (data, root, agents, logs):
    if overlaps(backup, other): fail('백업 저장소는 기록·게임·설정·로그 폴더와 겹치면 안 됩니다')
if backup_plist.exists() or backup_plist.is_symlink(): fail('백업 설정이 이미 있습니다(바꾸지 않습니다): ' + str(backup_plist))
environment = {'PATH': config.get('EnvironmentVariables', {}).get('PATH') or os.environ.get('PATH', '/usr/bin:/bin:/usr/sbin:/sbin'),
               'CARDS_STATE_DIR': str(data), 'CARDS_BACKUP_REPO': str(backup)}
job = {'Label': 'com.english-voca.backup', 'ProgramArguments': ['/bin/bash', str(root / 'tools/backup_state.sh')],
       'WorkingDirectory': str(root), 'EnvironmentVariables': environment, 'StartCalendarInterval': {'Hour': 21, 'Minute': 7},
       'StandardOutPath': str(logs / 'english-voca-backup.log'), 'StandardErrorPath': str(logs / 'english-voca-backup.log')}
print('백업 추가 계획')
print('  기록 폴더(서버 설정에서 읽음):', data)
print('  비공개 백업 저장소:', backup)
print('  매일 21:07 백업 설정:', backup_plist)
print('  백업 로그:', logs / 'english-voca-backup.log')
print('  서버·기록·기존 설정은 바꾸지 않습니다.' + (' 추가한 뒤 한 번 바로 백업합니다.' if args.now else ''))
if args.dry_run: print('dry-run: 파일을 만들지 않고 종료합니다.'); sys.exit(0)
if subprocess.run(['uname', '-s'], capture_output=True, text=True).stdout.strip() != 'Darwin': fail('macOS에서만 실행합니다')
try:
    print('위 내용으로 추가할까요? y 입력: ', end='', flush=True)
    with os.fdopen(3) as answer: approved = answer.readline().strip().lower() == 'y'
except (EOFError, OSError): approved = False
if not approved: print('추가하지 않았습니다. 파일을 바꾸지 않았습니다.'); sys.exit(0)
logs.mkdir(parents=True, exist_ok=True)
with backup_plist.open('xb') as dest: plistlib.dump(job, dest)
result = subprocess.run(['launchctl', 'bootstrap', 'gui/' + str(os.getuid()), str(backup_plist)], capture_output=True, text=True)
if result.returncode: fail('백업 예약 등록 실패. 만든 설정 파일은 남아 있습니다: ' + result.stderr.strip())
print('매일 21:07 백업을 예약했습니다.')
if args.now:
    print('지금 한 번 백업합니다…')
    done = subprocess.run(['/bin/bash', str(root / 'tools/backup_state.sh')], env={**os.environ, **environment}, cwd=str(root))
    print('백업 완료. 부모 기록 화면의 ④에 날짜가 나와요.' if done.returncode == 0 else '백업이 실패했어요. 위 메시지와 Mac의 GitHub 로그인 상태를 확인하세요. 예약은 그대로 남아 있습니다.')
    sys.exit(done.returncode)
PY
