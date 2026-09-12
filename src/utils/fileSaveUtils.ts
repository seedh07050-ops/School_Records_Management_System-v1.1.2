import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import { isTauriEnvironment, isElectronEnvironment } from './desktopBridge';
import { SaveFileResult } from '../types';

export interface SaveFileOptions {
  defaultFileName: string;
  title?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

/**
 * 엑셀 및 바이너리 데이터를 각 환경에 맞게 안전하게 파일로 저장
 * 1. Tauri v2 환경:
 *    - @tauri-apps/plugin-dialog의 save()로 파일 저장 대화상자 표시
 *    - @tauri-apps/plugin-fs의 writeFile()로 선택된 경로에 직접 쓰기
 *    - 오류 또는 권한 제한 발생 시 Rust 네이티브 save_excel_dialog / save_binary_file 커맨드로 100% 자동 Fallback
 * 2. Electron 환경:
 *    - window.electronAPI 호환 처리
 * 3. 웹 브라우저 환경:
 *    - Blob 객체 및 <a download>를 통한 안전 다운로드
 */
export async function saveBinaryFile(
  data: ArrayBuffer | Uint8Array,
  options: SaveFileOptions
): Promise<SaveFileResult> {
  const uint8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  const defaultFileName = options.defaultFileName;
  const ext = defaultFileName.includes('.') ? defaultFileName.split('.').pop() || 'xlsx' : 'xlsx';
  const filters = options.filters || [
    { name: 'Excel 통합 문서 (*.xlsx)', extensions: [ext] },
    { name: '모든 파일 (*.*)', extensions: ['*'] },
  ];

  // 1. Tauri v2 환경
  if (isTauriEnvironment()) {
    try {
      // 1-A. @tauri-apps/plugin-dialog의 save() 호출
      const selectedPath = await save({
        title: options.title || '파일 다른 이름으로 저장',
        defaultPath: defaultFileName,
        filters,
      });

      if (!selectedPath) {
        // 사용자가 저장을 취소한 경우
        return { success: false, canceled: true };
      }

      // 1-B. @tauri-apps/plugin-fs의 writeFile()로 파일 쓰기
      try {
        await writeFile(selectedPath, uint8);
        return { success: true, filePath: selectedPath, canceled: false };
      } catch (fsErr: any) {
        console.warn('plugin-fs writeFile 실패, Rust save_binary_file로 대체 시도:', fsErr);
        // Rust 백엔드 네이티브 명령어로 백업 저장 시도
        try {
          await invoke('save_binary_file', {
            filePath: selectedPath,
            data: Array.from(uint8),
          });
          return { success: true, filePath: selectedPath, canceled: false };
        } catch (invokeErr: any) {
          throw new Error(`파일 기록 실패: ${invokeErr?.message || fsErr?.message || '알 수 없는 오류'}`);
        }
      }
    } catch (dialogErr: any) {
      console.warn('Tauri plugin-dialog 실패, Rust save_excel_dialog로 대체 시도:', dialogErr);
      try {
        const res = await invoke<SaveFileResult>('save_excel_dialog', {
          defaultName: defaultFileName,
          data: Array.from(uint8),
        });
        return res;
      } catch (fallbackErr: any) {
        return {
          success: false,
          canceled: false,
          error: fallbackErr?.message || dialogErr?.message || '파일 저장에 실패했습니다.',
        };
      }
    }
  }

  // 2. Electron 데스크톱 환경
  if (isElectronEnvironment() && window.electronAPI?.showSaveDialog) {
    try {
      const dialogRes = await window.electronAPI.showSaveDialog({
        title: options.title || '파일 저장',
        defaultPath: defaultFileName,
      });
      if (dialogRes.canceled || !dialogRes.filePath) {
        return { success: false, canceled: true };
      }
    } catch {
      // fallback to web
    }
  }

  // 3. 일반 웹 브라우저 환경 (Blob + a[download])
  try {
    const blob = new Blob([uint8], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => window.URL.revokeObjectURL(url), 1500);
    return { success: true, canceled: false };
  } catch (webErr: any) {
    return {
      success: false,
      canceled: false,
      error: webErr?.message || '웹 다운로드 처리에 실패했습니다.',
    };
  }
}
