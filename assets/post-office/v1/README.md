# 우편 여행 공통 에셋 v1

원본: `tools/build_postal_assets.py`. SVG symbol 모음은 정수 좌표·단색 도형으로 제작했다. PNG 자동 절삭이나 타사 게임 이미지를 사용하지 않는다. `<svg><use href="sprites.svg#tree"/></svg>`처럼 symbol을 참조한다. 실제 연결 예시는 `showcase/post-office/`다.

캐릭터는 48, 건물·지형은 64, UI는 32 논리 픽셀이다. 확대는 정수 배율을 우선하고 SVG shape-rendering=crispEdges를 유지한다. 캐릭터 teal/gold는 외모나 성별 대신 가방·모자 색 구분이다.

음악은 두 개의 짧은 원작 AAC 루프와 동일 멜로디의 MIDI 편집 원본이다. 음성 우선, 음악·효과음 개별 설정을 제공한다. MIDI 파일을 브라우저에서 직접 재생하지 않는다. 게임 효과음은 8종 WAV다. 사람 녹음이나 단어 음성이 아니다. 합성 단어 음원 검수 완료로 표시하지 않는다.

이 폴더의 그래픽·짧은 작곡은 이 프로젝트를 위해 새로 작성했다. Galmuri 폰트는 `cards/fonts/OFL-Galmuri.txt`의 별도 라이선스를 보존한다.
