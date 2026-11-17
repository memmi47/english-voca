#!/bin/bash
# macOS user LaunchAgents only. Python handles paths/XML without shell interpolation.
set -euo pipefail
exec 3<&0
exec python3 - "$0" "$@" <<'PY'
import argparse, datetime, ipaddress, json, os, pathlib, plistlib, shutil, stat, subprocess, sys, time

root = pathlib.Path(sys.argv[1]).resolve().parent.parent
parser = argparse.ArgumentParser(description='Mac 집 안 서버 설치 (기록은 복사만 합니다)')
parser.add_argument('--data', default=str(pathlib.Path.home() / 'english-voca-data'))
parser.add_argument('--backup-repo', help='별도로 받아 둔 비공개 Git 저장소')
parser.add_argument('--dry-run', action='store_true')
args = parser.parse_args(sys.argv[2:])
user_home = pathlib.Path.home().resolve()
data = pathlib.Path(args.data).expanduser().resolve()
old = root / 'state-cards'
agents = (user_home / 'Library/LaunchAgents').resolve()
logs = (user_home / 'Library/Logs').resolve()
server_plist = agents / 'com.english-voca.server.plist'
backup_plist = agents / 'com.english-voca.backup.plist'
backup = pathlib.Path(args.backup_repo).expanduser().resolve() if args.backup_repo else None
python = shutil.which('python3')

def fail(message):
    raise SystemExit('설치 중단: ' + message)

def overlaps(a, b):
    return a == b or a in b.parents or b in a.parents

def inventory(path):
    print('파일 목록과 수정 시각:', path)
    if not path.exists():
        print('  (없음)'); return
    entries = sorted(path.rglob('*')) if path.is_dir() else [path]
    if not entries: print('  (비어 있음)')
    for entry in entries:
        modified = datetime.datetime.fromtimestamp(entry.lstat().st_mtime).astimezone().isoformat(timespec='seconds')
        print(' ', modified, entry.relative_to(path) if entry != path else entry.name)

def safe_tree(path):
    if not path.exists() and not path.is_symlink(): return
    for current in [path, *path.rglob('*')]:
        mode = current.lstat().st_mode
        if not (stat.S_ISDIR(mode) or stat.S_ISREG(mode)):
            fail('링크나 특수 파일은 자동으로 복사하지 않습니다: ' + str(current))

def check():
    if not python: fail('python3 실행 경로를 찾을 수 없습니다')
    if overlaps(data, root) or overlaps(data, agents) or overlaps(data, logs):
        fail('기록 폴더는 게임·LaunchAgents·로그 폴더와 겹치지 않는 별도 폴더여야 합니다')
    if backup and (overlaps(data, backup) or overlaps(root, backup) or overlaps(agents, backup) or overlaps(logs, backup)):
        fail('백업 저장소는 기록·게임·설정·로그와 겹치면 안 됩니다')
    if backup and not (backup / '.git').is_dir(): fail('별도로 git clone 한 백업 저장소가 필요합니다: ' + str(backup))
    if data.exists() and (not data.is_dir() or any(data.iterdir())):
        inventory(old); inventory(data)
        fail('새 기록 폴더가 비어 있지 않습니다. 아무 파일도 덮어쓰지 않았습니다')
    for path in (server_plist, backup_plist):
        if path.exists() or path.is_symlink(): fail('기존 설정을 덮어쓰지 않습니다: ' + str(path))
    if old.exists() and not old.is_dir(): fail('기존 state-cards가 폴더가 아닙니다')
    safe_tree(old)
    for path in (root / 'tools/serve_cards.py', root / 'tools/backup_state.sh'):
        if not path.is_file(): fail('필요한 파일이 없습니다: ' + str(path))

def run(command, **kwargs):
    return subprocess.run(command, text=True, capture_output=True, **kwargs)

def copy_into(source, target):
    for entry in sorted(source.iterdir()):
        dest = target / entry.name
        if entry.is_symlink(): fail('복사 중 링크가 생겼습니다: ' + str(entry))
        if entry.is_dir():
            dest.mkdir(mode=0o700)
            copy_into(entry, dest)
        else:
            with entry.open('rb') as src, dest.open('xb') as dst:
                shutil.copyfileobj(src, dst)
            shutil.copystat(entry, dest, follow_symlinks=False)

print('설치 계획')
print('  게임:', root)
print('  기존 기록을 복사:', old, '→', data)
print('  서버 자동 시작:', server_plist)
print('  Python:', python)
print('  서버 로그:', logs / 'english-voca-server.log')
print('  매일 21:07 백업:', str(backup) if backup else '선택하지 않음')
print('  원본 기록·백업 파일은 삭제하거나 덮어쓰지 않습니다. sudo·시스템 설정 변경은 없습니다.')
check()
if args.dry_run:
    print('dry-run: 파일 생성과 LaunchAgent 등록 없이 종료합니다.'); sys.exit(0)
if run(['uname', '-s']).stdout.strip() != 'Darwin': fail('실제 설치는 macOS에서만 실행합니다')
if not shutil.which('launchctl') or not shutil.which('curl'): fail('launchctl과 curl이 필요합니다')
if shutil.which('lsof'):
    occupied = run(['lsof', '-nP', '-iTCP:8090', '-sTCP:LISTEN'])
    if occupied.returncode == 0:
        fail('8090 서버가 이미 실행 중입니다. 기존 수동 서버를 종료한 뒤 다시 설치하세요\n' + occupied.stdout)
try:
    print('위 내용으로 설치할까요? y 입력: ', end='', flush=True)
    with os.fdopen(3) as confirmation:
        approved = confirmation.readline().strip().lower() == 'y'
except (EOFError, OSError):
    approved = False
if not approved:
    print('설치를 취소했습니다. 파일을 바꾸지 않았습니다.'); sys.exit(0)
check()  # Recheck after the user prompt before any writes.
data.mkdir(mode=0o700, parents=True, exist_ok=True)
if any(data.iterdir()): fail('확인 중 기록 폴더가 바뀌었습니다')
if old.exists(): copy_into(old, data)
agents.mkdir(parents=True, exist_ok=True)
logs.mkdir(parents=True, exist_ok=True)
environment = {'PATH': os.environ.get('PATH', '/usr/bin:/bin:/usr/sbin:/sbin'), 'CARDS_STATE_DIR': str(data)}
server = {
    'Label': 'com.english-voca.server',
    'ProgramArguments': [python, str(root / 'tools/serve_cards.py'), '--host', '0.0.0.0', '--port', '8090', '--state-dir', str(data)],
    'WorkingDirectory': str(root), 'EnvironmentVariables': {**environment, 'PYTHONUNBUFFERED': '1'},
    'RunAtLoad': True, 'KeepAlive': True,
    'StandardOutPath': str(logs / 'english-voca-server.log'), 'StandardErrorPath': str(logs / 'english-voca-server.log'),
}
jobs = [(server_plist, server)]
if backup:
    jobs.append((backup_plist, {
        'Label': 'com.english-voca.backup', 'ProgramArguments': ['/bin/bash', str(root / 'tools/backup_state.sh')],
        'WorkingDirectory': str(root), 'EnvironmentVariables': {**environment, 'CARDS_BACKUP_REPO': str(backup)},
        'StartCalendarInterval': {'Hour': 21, 'Minute': 7},
        'StandardOutPath': str(logs / 'english-voca-backup.log'), 'StandardErrorPath': str(logs / 'english-voca-backup.log'),
    }))
for path, config in jobs:
    with path.open('xb') as dest: plistlib.dump(config, dest)
domain = 'gui/' + str(os.getuid())
for path, config in jobs:
    result = run(['launchctl', 'bootstrap', domain, str(path)])
    if result.returncode: fail('LaunchAgent 시작 실패. 기록과 생성된 설정은 남아 있습니다: ' + result.stderr.strip())
print('접속 주소')
if shutil.which('scutil'):
    host = run(['scutil', '--get', 'LocalHostName']).stdout.strip()
    if host: print(' ', 'http://' + host + '.local:8090')
if shutil.which('ifconfig') and shutil.which('ipconfig'):
    for interface in run(['ifconfig', '-l']).stdout.split():
        if interface.startswith('lo'): continue
        ip = run(['ipconfig', 'getifaddr', interface]).stdout.strip()
        try:
            address = ipaddress.IPv4Address(ip)
            if not address.is_loopback and not address.is_unspecified: print(' ', interface, 'http://' + ip + ':8090')
        except ipaddress.AddressValueError:
            pass
for attempt in range(10):
    response = run(['curl', '--fail', '--silent', '--show-error', '--max-time', '2', 'http://127.0.0.1:8090/api/ping'])
    try: healthy = response.returncode == 0 and json.loads(response.stdout).get('ok') is True and json.loads(response.stdout).get('store') is True
    except (ValueError, AttributeError): healthy = False
    if healthy:
        print('/api/ping: OK — 기록 서버 응답을 확인했습니다.')
        print('설치 완료. iPad에서 위 주소를 열고 홈 화면에 추가하세요.'); break
    time.sleep(.3)
else:
    fail('/api/ping 응답을 확인하지 못했습니다. 설정과 기록은 보존했습니다. 서버 로그를 확인하세요')
PY
