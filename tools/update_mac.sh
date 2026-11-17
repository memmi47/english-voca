#!/bin/bash
# Save an exclusive copy before pull. A failed pull never stops the running job.
set -euo pipefail
exec python3 - "$0" "$@" <<'PY'
import argparse, datetime, json, os, pathlib, plistlib, shutil, stat, subprocess, sys, tempfile, time

root = pathlib.Path(sys.argv[1]).resolve().parent.parent
parser = argparse.ArgumentParser(description='기록 사본을 먼저 만든 뒤 게임 업데이트')
parser.add_argument('--dry-run', action='store_true')
args = parser.parse_args(sys.argv[2:])
label = 'com.english-voca.server'
plist = pathlib.Path.home() / 'Library/LaunchAgents' / (label + '.plist')
def fail(message): raise SystemExit('업데이트 중단: ' + message)
if plist.is_symlink(): fail('링크인 서버 설정은 사용하지 않습니다')
try: config = plistlib.loads(plist.read_bytes())
except (OSError, ValueError, plistlib.InvalidFileException): fail('설치된 서버 설정을 읽을 수 없습니다. 먼저 설치를 확인하세요')
program = config.get('ProgramArguments', [])
if config.get('Label') != label or config.get('WorkingDirectory') != str(root) or str(root / 'tools/serve_cards.py') not in program:
    fail('이 게임 폴더의 서버 설정이 아닙니다')
try: data = pathlib.Path(program[program.index('--state-dir') + 1]).expanduser().resolve()
except (ValueError, IndexError, TypeError): fail('서버 설정의 기록 폴더를 읽을 수 없습니다')
if data == root or root in data.parents or data in root.parents or not data.is_dir():
    fail('기록 폴더는 게임과 겹치지 않는 기존 폴더여야 합니다')
if (data / '.git').exists(): fail('백업 Git 저장소를 기록 폴더로 사용하지 않습니다')
backup_plist = plist.with_name('com.english-voca.backup.plist')
if backup_plist.exists():
    try:
        saved_backup = plistlib.loads(backup_plist.read_bytes()).get('EnvironmentVariables', {}).get('CARDS_BACKUP_REPO')
        if saved_backup:
            backup = pathlib.Path(saved_backup).expanduser().resolve()
            if data == backup or data in backup.parents or backup in data.parents:
                fail('기록 폴더와 백업 저장소가 겹칩니다')
    except (OSError, ValueError, plistlib.InvalidFileException): fail('백업 설정을 확인할 수 없습니다')
archive = data / 'before-update'
if archive.is_symlink() or (archive.exists() and not archive.is_dir()): fail('사본 보관 위치가 일반 폴더가 아닙니다')
for current, directories, files in os.walk(data, followlinks=False):
    here = pathlib.Path(current)
    if here == data: directories[:] = [d for d in directories if d != 'before-update']
    for name in directories + files:
        path = here / name
        if not (stat.S_ISDIR(path.lstat().st_mode) or stat.S_ISREG(path.lstat().st_mode)):
            fail('링크나 특수 파일은 자동 복사하지 않습니다: ' + str(path))
print('업데이트 계획: 기록 사본', data, '→', archive / '<시각>')
print('그다음 git pull --ff-only, 서버 재시작, /api/ping 확인. 기존 사본·원본은 보존합니다.')
if args.dry_run: sys.exit(0)
if subprocess.check_output(['uname', '-s'], text=True).strip() != 'Darwin': fail('실제 업데이트는 macOS에서만 실행합니다')
domain = 'gui/' + str(os.getuid())
probe = subprocess.run(['launchctl', 'print', domain + '/' + label], capture_output=True, text=True)
if probe.returncode not in (0, 3, 113): fail('서버 등록 상태를 확인할 수 없습니다')
archive.mkdir(mode=0o700, exist_ok=True)
snapshot = pathlib.Path(tempfile.mkdtemp(prefix=datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f') + '-', dir=archive))
def copy_into(source, target, top=False):
    for entry in sorted(source.iterdir()):
        if top and entry.name == 'before-update': continue
        dest = target / entry.name
        if entry.is_symlink(): fail('복사 중 링크가 생겼습니다: ' + str(entry))
        if entry.is_dir():
            dest.mkdir(mode=0o700); copy_into(entry, dest)
        elif entry.is_file():
            with entry.open('rb') as src, dest.open('xb') as dst: shutil.copyfileobj(src, dst)
            shutil.copystat(entry, dest, follow_symlinks=False)
        else: fail('복사 중 특수 파일이 생겼습니다: ' + str(entry))
copy_into(data, snapshot, top=True)
print('업데이트 전 사본:', snapshot)
pull = subprocess.run(['git', '-C', str(root), 'pull', '--ff-only'], text=True, capture_output=True)
print(pull.stdout, end='')
if pull.returncode:
    fail('git pull 실패. 서버를 중지/재시작하지 않았고 코드도 되돌리지 않았습니다. 사본: ' + str(snapshot) + '\n' + pull.stderr)
command = ['launchctl', 'kickstart', '-k', domain + '/' + label] if probe.returncode == 0 else ['launchctl', 'bootstrap', domain, str(plist)]
restart = subprocess.run(command, text=True, capture_output=True)
if restart.returncode: fail('서버 재시작 실패. 설치 설정·기록·사본은 보존했고 코드는 되돌리지 않았습니다\n' + restart.stderr)
for attempt in range(10):
    response = subprocess.run(['curl', '--fail', '--silent', '--show-error', '--max-time', '2', 'http://127.0.0.1:8090/api/ping'], capture_output=True, text=True)
    try: healthy = response.returncode == 0 and json.loads(response.stdout).get('ok') is True and json.loads(response.stdout).get('store') is True
    except (ValueError, AttributeError): healthy = False
    if healthy:
        print('/api/ping: OK — 업데이트 완료. 업데이트 전 사본은 그대로 남깁니다.'); break
    time.sleep(.3)
else: fail('/api/ping 실패. LaunchAgent 설정과 모든 기록/사본을 남겼습니다. 로그를 확인하세요. 코드는 자동으로 되돌리지 않습니다')
PY
