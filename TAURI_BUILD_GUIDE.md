# 학교 기록물 관리 시스템 - Tauri v2 기반 초경량 데스크톱 앱(.exe) 빌드 가이드

기존 100MB+ 이상의 Electron 기반 앱을 **Tauri (v2)** 기반으로 전면 전환하여, **10MB 안팎의 초경량 단일 Windows 실행 파일(.exe)**로 빌드할 수 있도록 모든 구성과 네이티브 코드가 완성되었습니다.

모든 기존 기능(과제카드 보존기간 추천, 엑셀 대장 내보내기/불러오기, 상자 라벨 인쇄, HWPX 표준 서식 5종 다운로드 등), UI 디자인, 사용자 경험(UX)은 **100% 동일**하게 작동합니다.

---

## 🚀 왜 Tauri v2인가요? (Electron과의 비교)

| 비교 항목 | 기존 Electron | **새로운 Tauri v2** |
| :--- | :--- | :--- |
| **실행 파일 크기** | 약 120MB ~ 150MB | **약 10MB ~ 15MB (약 90% 용량 절감)** |
| **렌더링 엔진** | Chromium 엔진을 통째로 패키징 | **Windows 내장 WebView2 런타임 활용** |
| **메모리(RAM) 점유율** | 약 150MB ~ 250MB | **약 30MB ~ 50MB (초경량 구동)** |
| **보안 모델** | 기본 Node.js 전체 접근 권한 | **Tauri v2 정밀 Capabilities 기반 권한 통제** |
| **오프라인 동작** | 100% 로컬 동작 | **100% 완전 오프라인 로컬 동작** |

---

## 📁 주요 프로젝트 및 Tauri v2 디렉토리 구조

```text
├── package.json                   # @tauri-apps/api, @tauri-apps/cli 및 빌드 스크립트 정의
├── vite.config.ts                 # base: './' 상대 경로 기반 Vite 번들링 설정
├── public/
│   ├── forms/                     # 한글 표준 업무서식 5종 (.hwpx)
│   │   ├── 기록물관리 책임자 지정.hwpx
│   │   ├── 기록물반출입대장.hwpx
│   │   ├── 문서고출입대장.hwpx
│   │   ├── 비전자기록물 이관계획.hwpx
│   │   └── 비전자기록물 인계인수서.hwpx
│   └── icon.png                   # 원본 256x256 앱 아이콘
├── src/
│   ├── utils/
│   │   └── desktopBridge.ts       # Tauri v2 / Electron / Web 통합 네이티브 브리지
│   ├── components/
│   │   ├── Header.tsx             # Tauri v2 데스크톱 앱 상태 감지 배지
│   │   └── WorkFormsView.tsx      # 네이티브 파일/폴더 저장 다이얼로그 연동 서식 다운로더
│   └── types.ts                   # DesktopAPI 및 파일 저장 결과 인터페이스
└── src-tauri/                     # ★ Tauri v2 백엔드 및 번들러 핵심 설정
    ├── Cargo.toml                 # Rust 패키지 및 플러그인 종속성 정의
    ├── build.rs                   # Tauri v2 빌드 스크립트
    ├── tauri.conf.json            # 창 크기, 식별자, 정적 자산 번들링, NSIS 인스톨러 설정
    ├── capabilities/
    │   └── default.json           # Tauri v2 보안 권한(dialog, fs, shell) 허용 정책
    ├── icons/                     # 32x32, 128x128, 256x256, icon.ico 등 윈도우용 아이콘
    └── src/
        ├── main.rs                # Windows 콘솔창 숨김 및 라이브러리 진입점
        └── lib.rs                 # HWPX 서식 네이티브 저장, 폴더 일괄 복사, 탐색기 연동 커맨드
```

---

## 📄 정적 자산 (.hwpx 서식 파일 5종) 관리 및 무결성 보장

`public/forms/` 경로의 5개 서식 파일은 다음 두 단계로 완벽하게 관리됩니다:

1. **Tauri 번들링 리소스 자동 포함 (`src-tauri/tauri.conf.json`)**:
   ```json
   "bundle": {
     "resources": [
       "../public/forms/*"
     ]
   }
   ```
   앱 빌드 시 생성되는 설치 패키지(`NSIS`)의 리소스 폴더에 5개 파일이 자동으로 포함됩니다.

2. **단일 포터블 .exe 실행을 위한 Rust 내장 바이너리 (`src-tauri/src/lib.rs`)**:
   - `include_bytes!` 매크로를 통해 5개 서식(약 200KB)을 Rust 실행파일 내부에 안전하게 임베딩하였습니다.
   - 따라서 별도 리소스 폴더를 풀지 않고 **단일 `.exe` 파일만 다른 PC로 복사하여 실행하더라도**, 서식 파일 저장 및 일괄 다운로드가 100% 무결하게 작동합니다.

---

## 🖥️ 프론트엔드 연동: `desktopBridge.ts`

프론트엔드에서는 Node.js의 `fs`/`path` 대신 Tauri v2의 IPC 커맨드와 `@tauri-apps/api/core`를 사용합니다:

```typescript
// 단일 서식 파일 저장: Windows 네이티브 파일 저장 대화상자 호출 및 디스크 쓰기
const res = await desktopBridge.saveFormFile(form.fileName);

// 업무서식 5종 일괄 저장: Windows 폴더 선택 대화상자 호출 후 5개 파일 동시 기록
const res = await desktopBridge.saveAllForms(fileNames);
```

- **Tauri 환경**: Rust 백엔드의 `save_single_form`, `save_all_forms` 커맨드를 호출하여 Windows 네이티브 저장창을 띄우고 디스크에 직접 안전하게 씁니다.
- **Web 브라우저 환경**: 표준 브라우저 Blob 다운로드 방식으로 자동 Fallback되어 웹 배포 시에도 문제없이 작동합니다.
- **기존 Electron 환경**: 레거시 `window.electronAPI`와 호환되도록 완벽한 어댑터를 제공합니다.

---

## 🛠️ Windows PC에서 단일 .exe 빌드하는 방법

### 1. 사전 필수 프로그램 설치 (최초 1회만 필요)

1. **[Node.js](https://nodejs.org/)** (v18 또는 v20 LTS 권장)
2. **[Rust](https://rustup.rs/)**:
   - `rustup-init.exe` 다운로드 후 실행하여 기본 옵션(1번)으로 설치합니다.
   - 터미널에서 `rustc --version` 및 `cargo --version`이 정상 출력되는지 확인합니다.
3. **C++ 빌드 도구 (Visual Studio Build Tools)**:
   - Visual Studio 설치 관리자에서 **"C++를 사용한 데스크톱 개발"**을 체크하고 설치합니다.
4. **WebView2**:
   - Windows 10(최신 업데이트) 및 Windows 11에는 기본 탑재되어 있으므로 별도 설치가 필요 없습니다.

---

### 2. 빌드 실행 단계

터미널(명령 프롬프트 `cmd` 또는 `PowerShell`)을 열고 프로젝트 폴더로 이동합니다.

```bash
# 1. 프론트엔드 종속성 설치
npm install

# 2. Tauri 데스크톱 앱 빌드 (릴리스 최적화)
npm run tauri:build
```

---

### 3. 생성된 실행 파일 확인

빌드가 완료되면 다음 위치에 약 **10MB 안팎의 단일 실행 파일 및 인스톨러**가 생성됩니다:

- **단일 무설치 독립 실행 파일**:
  `src-tauri/target/release/학교 기록물 관리 시스템.exe`
  *(이 .exe 파일 하나만 복사해서 어떤 Windows PC에서든 즉시 실행 가능합니다!)*

- **NSIS 설치 프로그램**:
  `src-tauri/target/release/bundle/nsis/학교 기록물 관리 시스템_1.0.0_x64-setup.exe`

---

## 🔍 로컬 개발 모드 실행

개발 중 실시간 UI 미리보기와 Rust 커맨드를 함께 테스트하려면:

```bash
npm run tauri:dev
```
이 명령은 Vite 개발 서버(포트 3000)를 실행한 뒤, Tauri WebView 창을 띄워 실시간 핫 리로딩 개발을 지원합니다.
