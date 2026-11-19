# Mac 집 안 서버 설치

Mac을 서버로 켜 두고, 같은 공유기의 iPad Safari에서 게임을 연다. 설치는 현재 로그인한 사용자에게만 적용한다. 관리자 권한이나 잠자기·방화벽 설정을 자동으로 바꾸지 않는다.

## 준비

- 이 설치 스크립트가 포함된 게임 폴더에서 터미널을 연다. 이미 게임을 받아 두었다면 그 폴더를 그대로 사용한다.
- `python3 --version`, `git --version`, `curl --version`이 실행되어야 한다. Python 3가 없으면 [python.org](https://www.python.org/downloads/macos/)의 무료 설치본 등을 먼저 설치한다.
- 기존 터미널에서 게임 서버를 실행 중이면 그 터미널에서 `Ctrl+C`로 종료한다. 실행 중인 8090 서버가 발견되면 설치는 멈춘다. 프로그램이 다른 서버를 강제로 종료하지 않는다.
- 기존 `state-cards/`와 외부 백업은 그대로 보관한다. 원본을 지우거나 옮기지 않는다.

## 설치

게임 폴더에서 먼저 계획만 확인한다.

```sh
bash tools/install_mac.sh --dry-run
```

이 명령은 파일을 만들거나 자동 시작을 등록하지 않는다. 실제 설치는 다음과 같다. 표시된 경로와 작업을 확인하고 `y`를 입력해야 진행한다.

```sh
bash tools/install_mac.sh
```

기록 위치 기본값은 `~/english-voca-data`다. 게임 안 `state-cards/`에 기록이 있으면 새 폴더로 모든 일반 파일과 하위 폴더를 **복사**한다. 원본의 내용과 수정 시각은 바꾸지 않는다. 새 폴더에 하나라도 항목이 있으면 원본/대상의 파일 목록·수정 시각을 보여 주고 멈춘다. 링크나 특수 파일은 자동으로 따라가지 않는다. 기존 LaunchAgent 설정도 덮어쓰지 않는다.

다른 기록 경로를 쓰려면 다음처럼 지정한다. 게임 폴더나 백업 저장소와 겹치는 경로는 사용할 수 없다.

```sh
bash tools/install_mac.sh --data "$HOME/english-voca-data" --dry-run
bash tools/install_mac.sh --data "$HOME/english-voca-data"
```

설치는 사용자 LaunchAgent `~/Library/LaunchAgents/com.english-voca.server.plist`를 만든다. 로그인하면 `python3 tools/serve_cards.py --host 0.0.0.0 --port 8090 --state-dir <기록 폴더>`를 실행하고, 종료되면 다시 시작한다. 로그인 전이나 Mac이 잠든 동안 계속 실행되는 시스템 서비스는 아니다. 서버 로그는 `~/Library/Logs/english-voca-server.log`에 남는다.

설치가 실패하면 원본과 복사된 기록을 그대로 보존하고 오류를 알린다. 일부 설정이 이미 만들어진 경우도 숨기지 않는다. 오류를 확인하지 않고 다시 설치하거나 기록 폴더를 비우지 않는다.

## 매일 외부 백업을 함께 예약

아이 기록을 올릴 별도의 **비공개** GitHub 저장소를 만들고 Mac에 `git clone`해 둔다. 게임 저장소는 공개이므로 백업 대상으로 사용할 수 없다. 기존 설치에 덮어 추가하는 방식은 지원하지 않으므로, 아래 옵션은 최초 설치 때 함께 지정한다.

```sh
bash tools/install_mac.sh --backup-repo "$HOME/english-voca-state" --dry-run
bash tools/install_mac.sh --backup-repo "$HOME/english-voca-state"
```

`com.english-voca.backup.plist`가 매일 Mac의 현지 시각 **21:07**에 기존 `tools/backup_state.sh`를 실행한다. `CARDS_STATE_DIR`와 `CARDS_BACKUP_REPO`에 선택한 경로를 명시한다. 설치 중 백업을 실행하거나 백업 저장소 파일을 변경하지 않는다. 백업 로그는 `~/Library/Logs/english-voca-backup.log`다. 실제 비공개 원격 확인과 전송은 기존 백업 스크립트가 담당하며 이 카드에서 그 동작을 변경하지 않았다.

### 이미 설치한 뒤에 매일 백업 추가하기

처음 설치할 때 `--backup-repo`를 주지 않았다면, 서버와 기록은 그대로 두고 매일 21:07 백업만 더할 수 있다(2026-11-20).

```sh
bash tools/backup_add_mac.sh --backup-repo "$HOME/english-voca-state" --dry-run   # 계획만 보기
bash tools/backup_add_mac.sh --backup-repo "$HOME/english-voca-state" --now       # y 입력 후 예약하고 한 번 바로 백업
```

기록 폴더는 설치된 서버 설정에서 읽는다. 백업 설정이 이미 있으면 바꾸지 않고 멈춘다.

원격 주소·push 설정을 바꾼 저장소에서는 [C-007의 백업 검토 사항](https://github.com/memmi47/english-voca/pull/14)도 확인한다. 실제 백업이 도착했는지는 비공개 저장소에서 최근 기록을 확인한다. Mac에 사용자의 Git 인증이 설정돼 있어야 하며 설치기는 토큰이나 암호를 저장하지 않는다. Mac이 꺼져 있거나 로그아웃한 동안의 예약 실행은 보장하지 않는다.

## iPad에서 접속과 확인

설치 마지막에 표시되는 `http://<컴퓨터 이름>.local:8090`을 iPad Safari에서 연다. `.local` 이름은 Mac의 `scutil --get LocalHostName` 값이다. 연결된 유선·무선 인터페이스에서 찾은 IPv4 주소도 모두 표시하므로 `http://<IP>:8090`으로 열 수도 있다. IP는 공유기 설정이나 연결 상태에 따라 바뀐다.

1. Mac에서 설치 결과의 `/api/ping: OK`를 확인한다.
2. iPad에서 아이 선택과 지도 표시를 확인한다.
3. 공유 버튼 → **홈 화면에 추가**를 누른다.
4. Mac을 재시동하고 같은 사용자로 로그인한 뒤 iPad에서 다시 연다.

## 업데이트

설치된 서버의 plist에서 실제 기록 경로를 읽는다. `--dry-run`으로 먼저 경로를 확인할 수 있다.

```sh
bash tools/update_mac.sh --dry-run
bash tools/update_mac.sh
```

`<기록 폴더>/before-update/<시각>-<고유값>/`에 새 사본을 만든 **뒤에만** `git pull --ff-only`를 실행한다. `daily/`, `backup/`, `rejected/` 등은 포함하며 이전 `before-update/`는 재귀적으로 복사하지 않는다. 기존 사본과 원본은 덮어쓰지 않으며 같은 시각에 실행해도 다른 새 폴더를 만든다.

pull이 실패하면 기존 서버를 중지하거나 재시작하지 않고, 만든 사본을 남겨 둔다. pull이 성공하면 서버를 재시작하고 `/api/ping`을 확인한다. 재시작이나 ping이 실패하면 오류와 로그 위치를 확인한다. 기록·설정·사본은 보존하며 코드를 자동으로 되돌리지는 않는다. 기존 데이터가 없는 새 폴더로 서버 설정을 임의 변경하지 않는다.

## 자동 시작 제거

```sh
bash tools/uninstall_mac.sh --dry-run
bash tools/uninstall_mac.sh
```

이 게임 폴더에서 만든 것으로 확인되는 두 LaunchAgent만 해제하고 해당 plist만 제거한다. **기록 폴더·원본 `state-cards/`·백업 저장소·로그는 남긴다.** 남아 있는 기록 폴더를 대상으로 재설치하면 보호 규칙에 따라 중단한다. 기록을 비우거나 이동해서 우회하지 말고 경로와 필요한 복원 절차를 확인한다.

## 안 열릴 때

| 증상 | 확인할 것 |
|---|---|
| iPad만 열리지 않음 | Mac과 iPad가 같은 공유기인지 확인한다. Mac 유선·iPad 무선도 가능하지만 게스트 Wi-Fi나 기기 간 통신 차단이 있으면 공유기에서 허용해야 한다. |
| Mac에서도 열리지 않음 | `http://127.0.0.1:8090/api/ping`과 서버 로그를 확인한다. Mac의 해당 사용자로 로그인했는지도 확인한다. |
| 잠시 뒤 끊김 | Mac이 잠들었는지 확인한다. 필요한 경우 부모가 시스템 설정에서 잠자기 방침을 정한다. 설치기는 바꾸지 않는다. |
| 방화벽 질문/연결 거부 | 부모가 macOS 방화벽에서 사용 중인 Python의 집 안 연결을 허용한다. 방화벽 전체를 끄거나 인터넷에 포트를 공개할 필요는 없다. |
| `.local` 주소만 실패 | 설치 때 표시된 IP 주소로 연다. 공유기에서 Mac에 고정 DHCP 주소를 주면 주소가 덜 바뀐다. |
| 기존 기록/설정이 있어 중단 | 표시된 양쪽 파일 목록과 수정 시각을 확인한다. 자동 병합·덮어쓰기·폴더 비우기를 하지 않는다. |
| 업데이트 실패 | 사본 경로와 Git 오류를 확인한다. 기존 서버는 pull 실패 때 재시작하지 않는다. 코드 강제 초기화나 기록 삭제로 해결하지 않는다. |
| 백업이 오래됨 | 백업 로그, 로그인·전원 상태, Git 인증, 비공개 저장소에 실제 기록이 도착했는지 확인한다. |

## 기록이 남는 곳

iPad/Mac 브라우저의 작업본, 게임 폴더 밖 서버 기록, 서버의 직전 버전·날짜별 사본, 업데이트 전 사본이 남는다. 선택한 경우 별도 비공개 Git 저장소에도 백업한다. 원래 게임 폴더 안 `state-cards/`에서 복사해 설치했다면 그 원본도 남지만 이후 플레이의 최신본은 새 기록 폴더다. 새 기록 폴더와 백업을 지우지 않는다. 자세한 합치기·복원 방침은 [진행 기록 보호](DATA_SAFETY.md)를 따른다.

이 문서의 자동 검증은 Linux의 임시 HOME과 가짜 macOS 명령으로 수행한다. 실제 macOS LaunchAgent 등록, 재로그인·재시동, 잠자기 중 동작, iPad Wi-Fi 접속과 실제 비공개 원격 백업은 사용자의 기기 확인 항목이다.
