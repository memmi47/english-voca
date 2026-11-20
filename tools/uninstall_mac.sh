#!/bin/bash
# Remove only this checkout's two generated LaunchAgent plists; records are retained.
set -euo pipefail
exec python3 - "$0" "$@" <<'PY'
import argparse, os, pathlib, plistlib, subprocess, sys

root = pathlib.Path(sys.argv[1]).resolve().parent.parent
parser = argparse.ArgumentParser(description='서버 자동 시작 해제 (기록·백업 보존)')
parser.add_argument('--dry-run', action='store_true')
args = parser.parse_args(sys.argv[2:])
agents = (pathlib.Path.home() / 'Library/LaunchAgents').resolve()
domain = 'gui/' + str(os.getuid())
jobs = []
protected = [(root / 'state-cards').resolve()]
def fail(message): raise SystemExit('제거 중단: ' + message)
for label, script in [('com.english-voca.backup', 'backup_state.sh'), ('com.english-voca.server', 'serve_cards.py')]:
    path = agents / (label + '.plist')
    if path.is_symlink(): fail('링크인 설정은 제거하지 않습니다: ' + str(path))
    if not path.exists(): continue
    try: config = plistlib.loads(path.read_bytes())
    except (ValueError, OSError, plistlib.InvalidFileException): fail('읽을 수 없는 설정: ' + str(path))
    if config.get('Label') != label or config.get('WorkingDirectory') != str(root) or str(root / 'tools' / script) not in config.get('ProgramArguments', []):
        fail('이 게임 폴더가 만든 설정인지 확인할 수 없습니다: ' + str(path))
    program = config.get('ProgramArguments', [])
    if label.endswith('.server'):
        try: protected.append(pathlib.Path(program[program.index('--state-dir') + 1]).resolve())
        except (ValueError, IndexError, TypeError): fail('기록 폴더를 확인할 수 없어 설정을 보존합니다')
    saved_backup = config.get('EnvironmentVariables', {}).get('CARDS_BACKUP_REPO')
    if saved_backup: protected.append(pathlib.Path(saved_backup).resolve())
    jobs.append((path, label))
for path, label in jobs:
    if any(path == folder or folder in path.parents for folder in protected):
        fail('설정 경로가 기록 또는 백업 안에 있습니다. 파일을 지우지 않습니다: ' + str(path))
print('자동 시작 해제와 plist 제거:', *(str(path) for path, _ in jobs), sep='\n  ')
print('기록 폴더, 게임 안 state-cards, 백업 저장소, 로그는 그대로 둡니다.')
if args.dry_run: sys.exit(0)
if subprocess.check_output(['uname', '-s'], text=True).strip() != 'Darwin': fail('실제 제거는 macOS에서만 실행합니다')
for path, label in jobs:
    probe = subprocess.run(['launchctl', 'print', domain + '/' + label], capture_output=True, text=True)
    if probe.returncode == 0:
        result = subprocess.run(['launchctl', 'bootout', domain, str(path)], capture_output=True, text=True)
        if result.returncode: fail('자동 시작 해제 실패. plist는 보존합니다: ' + result.stderr.strip())
    elif probe.returncode not in (3, 113):
        fail('등록 상태를 확인할 수 없습니다. plist는 보존합니다: ' + probe.stderr.strip())
    path.unlink()  # Only the validated, generated configuration file, never a record.
print('자동 시작을 해제했습니다. 기록과 백업은 남아 있습니다.')
PY
