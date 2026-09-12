# 학교 기록물 관리 시스템 - Windows 데스크톱 앱(.exe) 빌드 가이드

이 프로젝트는 웹 브라우저뿐만 아니라 **일렉트론(Electron)** 기반의 **Windows 데스크톱 독립 실행형 애플리케이션(.exe)**으로 빌드하여 사용할 수 있도록 모든 구성이 완료되어 있습니다.

---

## 📁 주요 추가 및 구성 파일

1. **`electron/main.cjs`**: Electron 메인 프로세스 (윈도우 생성, 메뉴바 단축키, 창 최소화/최대화/닫기, 보안 격리, 로컬 파일 프로토콜 지원)
2. **`electron/preload.cjs`**: 렌더러-메인 간 안전한 통신을 제공하는 ContextBridge 스크립트
3. **`electron-builder.json`**: Windows 64비트 설치형(NSIS) 및 무설치형(Portable) 실행파일 빌드 설정
4. **`public/icon.png`**: 데스크톱 프로그램 및 인스톨러용 앱 아이콘
5. **`vite.config.ts`**: `base: './'` 상대 경로 설정으로 Electron의 `file://` 로컬 프로토콜 및 오프라인 완벽 호환

---

## 🚀 실행 및 빌드 명령어 (npm scripts)

| 명령어 | 설명 |
| :--- | :--- |
| `npm run electron:dev` | 개발 환경에서 로컬 개발 서버와 함께 Electron 데스크톱 앱을 실행합니다. |
| `npm run electron:preview` | 번들 빌드(`dist`) 후 로컬 파일 기반으로 Electron 데스크톱 앱을 미리 실행합니다. |
| **`npm run build:win`** | **Windows 64비트 설치형 실행파일(.exe)**을 빌드합니다. (NSIS 인스톨러) |
| **`npm run build:win:portable`** | **단일 파일로 즉시 실행 가능한 무설치형 실행파일(.exe)**을 빌드합니다. |
| **`npm run build:win:all`** | 설치형과 무설치형 .exe를 모두 빌드합니다. |
| `npm run pack` | 인스톨러 패키징 없이 압축 해제된 실행 디렉터리(`release/win-unpacked`)만 빠르게 생성합니다. |

---

## 🛠️ Windows PC에서 .exe 빌드하는 방법

1. **소스코드 다운로드**:
   - AI Studio 우측 상단 메뉴 또는 Git에서 프로젝트 소스코드를 다운로드(ZIP 압축 해제)합니다.
2. **필수 환경 준비**:
   - [Node.js](https://nodejs.org/) (v18 또는 v20 이상 권장) 설치
3. **터미널(명령 프롬프트 or PowerShell) 실행 후 종속성 확인**:
   ```bash
   npm install
   ```
4. **Windows 실행파일 생성**:
   - **무설치 포터블 단일 .exe 생성**:
     ```bash
     npm run build:win:portable
     ```
   - **인스톨러 설치형 .exe 생성**:
     ```bash
     npm run build:win
     ```
5. **결과 파일 확인**:
   - 빌드가 완료되면 프로젝트 루트의 `release/` 폴더 내에 생성됩니다:
     - `release/학교 기록물 관리 시스템 Setup 1.0.0.exe` (설치 프로그램)
     - `release/학교 기록물 관리 시스템_v1.0.0_무설치_Portable.exe` (무설치 단독 실행파일)

---

## 💡 데스크톱 앱의 주요 특징 및 데이터 보관

- **완전한 오프라인 작동**:
  인터넷 연결이나 외부 API 서버 없이도 과제카드 보존기간 추천, 엑셀 대량 등록/내보내기, 라벨 출력 등 모든 기능이 100% 로컬에서 동작합니다.
- **데이터 영구 보관**:
  기록물 데이터, 과제카드 목록, 기관 정보는 사용자의 PC AppData(`%APPDATA%/학교 기록물 관리 시스템`)에 안전하게 저장되어 앱을 재실행하거나 PC를 껐다 켜도 영구 보존됩니다.
- **표준 서식 5종 내장 및 네이티브 저장 지원**:
  내장된 HWPX 표준 서식 파일이 앱 패키지 리소스에 포함되어 있습니다. Electron 데스크톱 앱에서는 Windows 네이티브 파일 저장 대화상자를 통해 원하는 폴더에 파일이 즉시 안전하게 기록되며, 5종 서식을 한 번에 원하는 폴더로 일괄 저장하는 기능도 지원합니다. (웹 브라우저에서는 표준 Blob 다운로드 방식으로 지원)
