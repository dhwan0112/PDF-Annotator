# Marginalia

PDF 어노테이션 및 마인드맵 도구입니다. 스터디 그룹 기능으로 여러 PDF를 묶어 관리하고, Dropbox를 통해 여러 컴퓨터에서 동기화할 수 있습니다.

## 주요 기능

### PDF 어노테이션
- **펜 (P)**: 자유롭게 필기 (압력 감지 지원)
- **형광펜 (H)**: 텍스트 하이라이트
- **밑줄 (U)**: 텍스트에 밑줄
- **취소선 (S)**: 텍스트에 취소선
- **스티키 노트 (N)**: 메모 추가
- **사각형 (R)**: 영역 표시
- **화살표 (A)**: 화살표 그리기
- **텍스트 박스 (T)**: 텍스트 입력
- **지우개 (E)**: 어노테이션 삭제

### 선택 모드
선택 도구(V)에서 다음 모드를 사용할 수 있습니다:
- **올가미 선택**: 자유롭게 영역을 그려서 선택
- **사각형 선택**: 사각형 영역으로 선택
- **텍스트 선택**: 텍스트를 선택하여 하이라이트/밑줄/취소선 적용

### 스터디 그룹
PDF를 그룹으로 묶어서 관리할 수 있습니다.
- 라이브러리에서 새 스터디 그룹 생성
- PDF 탭을 우클릭하여 그룹에 추가
- 각 그룹별로 마인드맵 생성 가능

### 마인드맵
스터디 그룹 내 PDF들의 어노테이션을 마인드맵으로 정리할 수 있습니다.
- **Ctrl+Shift+M**: 마인드맵 패널 토글
- **Ctrl+1**: PDF만 보기
- **Ctrl+2**: 마인드맵만 보기
- **Ctrl+3**: 분할 보기 (PDF + 마인드맵)
- 어노테이션을 선택 후 마인드맵으로 드래그하여 노드 추가
- 노드끼리 연결하여 관계 표시
- 노드를 더블클릭하면 원본 문서로 이동

### 탭 기능
- 여러 PDF를 탭으로 열어 빠르게 전환
- 탭 우클릭으로 스터디 그룹 지정
- 이전 세션 자동 복원

---

## 키보드 단축키

모든 단축키는 설정에서 커스터마이징 가능합니다.

### 도구
| 단축키 | 기능 |
|--------|------|
| V | 선택 도구 |
| P | 펜 |
| H | 형광펜 |
| E | 지우개 |
| N | 스티키 노트 |
| U | 밑줄 |
| S | 취소선 |
| R | 사각형 |
| A | 화살표 |
| T | 텍스트 박스 |

### 편집
| 단축키 | 기능 |
|--------|------|
| Ctrl+Z | 실행 취소 |
| Ctrl+Y | 다시 실행 |
| Ctrl+Shift+Z | 다시 실행 (대체) |
| Delete/Backspace | 선택한 어노테이션 삭제 |
| Escape | 선택 해제 / 라이브러리로 돌아가기 |

### 보기
| 단축키 | 기능 |
|--------|------|
| Ctrl++ | 확대 |
| Ctrl+- | 축소 |

### 탐색
| 단축키 | 기능 |
|--------|------|
| Page Down | 다음 페이지 |
| Page Up | 이전 페이지 |
| Home | 첫 페이지 |
| End | 마지막 페이지 |

### 파일
| 단축키 | 기능 |
|--------|------|
| Ctrl+O | 파일 열기 |
| Ctrl+S | 어노테이션 포함 PDF 저장 |

### 기능
| 단축키 | 기능 |
|--------|------|
| Ctrl+M | 여백 그리기 토글 |
| Ctrl+Shift+M | 마인드맵 패널 토글 |
| Ctrl+1 | PDF만 보기 |
| Ctrl+2 | 마인드맵만 보기 |
| Ctrl+3 | 분할 보기 |

---

## Dropbox 동기화 설정

여러 컴퓨터에서 어노테이션과 스터디 그룹을 동기화할 수 있습니다.

### 1. Dropbox 앱 생성

1. [Dropbox Developer Console](https://www.dropbox.com/developers/apps)에 접속
2. **Create app** 클릭
3. 다음과 같이 설정:
   - **API**: Scoped access
   - **Access type**: App folder
   - **Name**: 원하는 앱 이름 (예: Marginalia-Sync)
4. **Create app** 클릭

### 2. 권한 설정

생성된 앱의 **Permissions** 탭에서 다음 권한을 활성화:
- `files.metadata.read`
- `files.content.read`
- `files.content.write`

**Submit** 클릭하여 저장

### 3. App Key 복사

**Settings** 탭에서 **App key**를 복사

### 4. Marginalia에서 연결

1. Marginalia 실행
2. 설정 (톱니바퀴 아이콘) → **동기화** 탭
3. **App Key** 입력란에 복사한 키 붙여넣기
4. **Save** 클릭
5. **Dropbox 연결** 클릭
6. 열리는 Dropbox 페이지에서 앱 승인
7. 표시되는 인증 코드를 복사하여 Marginalia에 붙여넣기

### 5. 동기화 사용

- **지금 동기화**: 수동으로 동기화 실행
- 동기화되는 항목:
  - 스터디 그룹 정보
  - 문서별 어노테이션
  - 북마크
  - 마인드맵

---

## 설치

### 사전 요구사항
- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/)
- [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)

### 개발 환경 실행

```bash
# 의존성 설치
npm install

# 개발 모드 실행
npm run tauri:dev
```

### 프로덕션 빌드

```bash
npm run tauri:build
```

빌드된 파일은 `src-tauri/target/release/bundle/` 에서 찾을 수 있습니다.

---

## 기술 스택

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Tauri (Rust)
- **PDF 렌더링**: PDF.js
- **PDF 편집**: pdf-lib
- **필기**: perfect-freehand (압력 감지)
- **상태 관리**: Zustand

---

## 라이선스

MIT License
