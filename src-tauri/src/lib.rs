use std::path::{Path, PathBuf};
use tauri::Manager;

#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct SaveFileResult {
    pub success: bool,
    #[serde(rename = "filePath", skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub canceled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct SaveAllFormsResult {
    pub success: bool,
    #[serde(rename = "folderPath", skip_serializing_if = "Option::is_none")]
    pub folder_path: Option<String>,
    #[serde(rename = "savedCount")]
    pub saved_count: usize,
    #[serde(rename = "savedFiles")]
    pub saved_files: Vec<String>,
    pub errors: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub canceled: Option<bool>,
}

// 9개 .hwpx 정적 서식 파일의 내장 바이너리 (단일 포터블 .exe 실행 시에도 외부 폴더 없이 100% 보장)
static FORM_MANAGER_BYTES: &[u8] = include_bytes!("../../public/forms/기록물관리 책임자 지정.hwpx");
static FORM_IN_OUT_BYTES: &[u8] = include_bytes!("../../public/forms/기록물반출입대장.hwpx");
static FORM_ARCHIVE_ACCESS_BYTES: &[u8] = include_bytes!("../../public/forms/문서고출입대장.hwpx");
static FORM_TRANSFER_PLAN_BYTES: &[u8] = include_bytes!("../../public/forms/비전자기록물 이관계획.hwpx");
static FORM_HANDOVER_BYTES: &[u8] = include_bytes!("../../public/forms/비전자기록물 인계인수서.hwpx");
static FORM_MINUTES_IN_PERSON_BYTES: &[u8] = include_bytes!("../../public/forms/회의록서식(대면회의).hwpx");
static FORM_MINUTES_WRITTEN_BYTES: &[u8] = include_bytes!("../../public/forms/회의록서식(서면회의).hwpx");
static FORM_DISCARDED_SEAL_BYTES: &[u8] = include_bytes!("../../public/forms/폐기공인 이관.hwpx");
static FORM_HISTORICAL_ARTIFACTS_BYTES: &[u8] = include_bytes!("../../public/forms/교육행정박물관리대장.hwpx");

/// 서식 파일의 실제 바이트 데이터 조회
/// 1) 번들된 리소스 디렉터리 및 디스크 경로 검색
/// 2) 미발견 시 내장된 바이너리 캐시에서 즉시 반환 (단일 실행파일 무결성 보장)
fn get_form_bytes(app: &tauri::AppHandle, file_name: &str) -> Option<Vec<u8>> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    // 1. Tauri 리소스 경로 확인
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("forms").join(file_name));
        candidates.push(resource_dir.join(file_name));
        candidates.push(resource_dir.join("_up_").join("public").join("forms").join(file_name));
    }

    // 2. 실행파일 디렉터리 기준 경로
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            candidates.push(exe_dir.join("forms").join(file_name));
            candidates.push(exe_dir.join("resources").join("forms").join(file_name));
            candidates.push(exe_dir.join("resources").join(file_name));
        }
    }

    // 3. 현재 작업 디렉터리 기준 경로
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("public").join("forms").join(file_name));
        candidates.push(cwd.join("..").join("public").join("forms").join(file_name));
        candidates.push(cwd.join("dist").join("forms").join(file_name));
        candidates.push(cwd.join("..").join("dist").join("forms").join(file_name));
        candidates.push(cwd.join("forms").join(file_name));
    }

    for path in candidates {
        if path.exists() && path.is_file() {
            if let Ok(data) = std::fs::read(path) {
                return Some(data);
            }
        }
    }

    // 4. 내장 바이너리(Zero-Dependency fallback)
    match file_name {
        "기록물관리 책임자 지정.hwpx" => Some(FORM_MANAGER_BYTES.to_vec()),
        "기록물반출입대장.hwpx" => Some(FORM_IN_OUT_BYTES.to_vec()),
        "문서고출입대장.hwpx" => Some(FORM_ARCHIVE_ACCESS_BYTES.to_vec()),
        "비전자기록물 이관계획.hwpx" => Some(FORM_TRANSFER_PLAN_BYTES.to_vec()),
        "비전자기록물 인계인수서.hwpx" => Some(FORM_HANDOVER_BYTES.to_vec()),
        "회의록서식(대면회의).hwpx" => Some(FORM_MINUTES_IN_PERSON_BYTES.to_vec()),
        "회의록서식(서면회의).hwpx" => Some(FORM_MINUTES_WRITTEN_BYTES.to_vec()),
        "폐기공인 이관.hwpx" => Some(FORM_DISCARDED_SEAL_BYTES.to_vec()),
        "교육행정박물관리대장.hwpx" => Some(FORM_HISTORICAL_ARTIFACTS_BYTES.to_vec()),
        _ => None,
    }
}

/// 단일 서식 파일 네이티브 저장 (Windows 파일 저장 대화상자)
#[tauri::command]
fn save_single_form(app: tauri::AppHandle, file_name: String) -> SaveFileResult {
    let bytes = match get_form_bytes(&app, &file_name) {
        Some(b) => b,
        None => {
            return SaveFileResult {
                success: false,
                file_path: None,
                canceled: Some(false),
                error: Some(format!("서식 원본 파일을 찾을 수 없습니다: {}", file_name)),
            };
        }
    };

    let ext = Path::new(&file_name)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("hwpx");

    let mut dialog = rfd::FileDialog::new()
        .set_title("서식 파일 다른 이름으로 저장")
        .set_file_name(&file_name)
        .add_filter("한글 표준 문서 (*.hwpx)", &[ext])
        .add_filter("모든 파일 (*.*)", &["*"]);

    // 기본 다운로드 폴더 설정
    if let Ok(download_dir) = app.path().download_dir() {
        dialog = dialog.set_directory(download_dir);
    }

    let save_path = match dialog.save_file() {
        Some(p) => p,
        None => {
            return SaveFileResult {
                success: false,
                file_path: None,
                canceled: Some(true),
                error: None,
            };
        }
    };

    match std::fs::write(&save_path, bytes) {
        Ok(_) => SaveFileResult {
            success: true,
            file_path: Some(save_path.to_string_lossy().into_owned()),
            canceled: Some(false),
            error: None,
        },
        Err(e) => SaveFileResult {
            success: false,
            file_path: None,
            canceled: Some(false),
            error: Some(e.to_string()),
        },
    }
}

/// 업무서식 9종 일괄 저장 (Windows 폴더 선택 대화상자)
#[tauri::command]
fn save_all_forms(app: tauri::AppHandle, file_names: Vec<String>) -> SaveAllFormsResult {
    let mut dialog = rfd::FileDialog::new().set_title("업무서식 9종을 저장할 폴더를 선택하세요");

    if let Ok(download_dir) = app.path().download_dir() {
        dialog = dialog.set_directory(download_dir);
    }

    let target_dir = match dialog.pick_folder() {
        Some(p) => p,
        None => {
            return SaveAllFormsResult {
                success: false,
                folder_path: None,
                saved_count: 0,
                saved_files: Vec::new(),
                errors: Vec::new(),
                canceled: Some(true),
            };
        }
    };

    let mut saved_files = Vec::new();
    let mut errors = Vec::new();

    for name in file_names {
        match get_form_bytes(&app, &name) {
            Some(bytes) => {
                let dest = target_dir.join(&name);
                match std::fs::write(&dest, bytes) {
                    Ok(_) => saved_files.push(name),
                    Err(e) => errors.push(format!("{}: {}", name, e)),
                }
            }
            None => {
                errors.push(format!("{} (원본 파일 없음)", name));
            }
        }
    }

    SaveAllFormsResult {
        success: !saved_files.is_empty(),
        folder_path: Some(target_dir.to_string_lossy().into_owned()),
        saved_count: saved_files.len(),
        saved_files,
        errors,
        canceled: Some(false),
    }
}

/// 서식 파일 Base64 읽기 (필요시 프론트엔드 직접 처리용)
#[tauri::command]
fn read_form_file_base64(app: tauri::AppHandle, file_name: String) -> Result<String, String> {
    match get_form_bytes(&app, &file_name) {
        Some(bytes) => {
            use std::io::Write;
            // Simple manual base64 encoder or return hex
            const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
            let mut out = String::with_capacity((bytes.len() * 4) / 3 + 4);
            let chunks = bytes.chunks(3);
            for chunk in chunks {
                let b0 = chunk[0];
                let b1 = chunk.get(1).copied().unwrap_or(0);
                let b2 = chunk.get(2).copied().unwrap_or(0);

                let idx0 = (b0 >> 2) as usize;
                let idx1 = (((b0 & 0b00000011) << 4) | (b1 >> 4)) as usize;
                let idx2 = (((b1 & 0b00001111) << 2) | (b2 >> 6)) as usize;
                let idx3 = (b2 & 0b00111111) as usize;

                out.push(CHARSET[idx0] as char);
                out.push(CHARSET[idx1] as char);
                if chunk.len() > 1 {
                    out.push(CHARSET[idx2] as char);
                } else {
                    out.push('=');
                }
                if chunk.len() > 2 {
                    out.push(CHARSET[idx3] as char);
                } else {
                    out.push('=');
                }
            }
            Ok(out)
        }
        None => Err(format!("서식 파일을 찾을 수 없습니다: {}", file_name)),
    }
}

/// 외부 웹 링크를 기본 브라우저에서 열기
#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
}

/// 폴더 또는 파일을 기본 프로그램/탐색기로 열기
#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
}

/// 탐색기에서 파일 선택 표시 (Windows: explorer.exe /select,...)
#[tauri::command]
fn show_item_in_folder(full_path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(format!("/select,\"{}\"", full_path))
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &full_path])
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let parent = Path::new(&full_path)
            .parent()
            .unwrap_or_else(|| Path::new("."));
        std::process::Command::new("xdg-open")
            .arg(parent)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
}

/// 일반 바이너리 데이터 직접 파일 저장 (지정 경로)
#[tauri::command]
fn save_binary_file(file_path: String, data: Vec<u8>) -> Result<(), String> {
    std::fs::write(&file_path, data).map_err(|e| e.to_string())
}

/// 엑셀 파일 저장 대화상자 호출 및 기록 (Native FileDialog)
#[tauri::command]
fn save_excel_dialog(app: tauri::AppHandle, default_name: String, data: Vec<u8>) -> SaveFileResult {
    let mut dialog = rfd::FileDialog::new()
        .set_title("엑셀 파일 다른 이름으로 저장")
        .set_file_name(&default_name)
        .add_filter("Excel 통합 문서 (*.xlsx)", &["xlsx"])
        .add_filter("모든 파일 (*.*)", &["*"]);

    if let Ok(download_dir) = app.path().download_dir() {
        dialog = dialog.set_directory(download_dir);
    }

    let save_path = match dialog.save_file() {
        Some(p) => p,
        None => {
            return SaveFileResult {
                success: false,
                file_path: None,
                canceled: Some(true),
                error: None,
            };
        }
    };

    match std::fs::write(&save_path, data) {
        Ok(_) => SaveFileResult {
            success: true,
            file_path: Some(save_path.to_string_lossy().into_owned()),
            canceled: Some(false),
            error: None,
        },
        Err(e) => SaveFileResult {
            success: false,
            file_path: None,
            canceled: Some(false),
            error: Some(e.to_string()),
        },
    }
}

/// 애플리케이션 버전 조회
#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            save_single_form,
            save_all_forms,
            save_binary_file,
            save_excel_dialog,
            read_form_file_base64,
            open_external,
            open_path,
            show_item_in_folder,
            get_app_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
