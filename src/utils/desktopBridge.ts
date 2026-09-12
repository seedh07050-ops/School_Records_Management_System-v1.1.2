import { invoke, isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { DesktopAPI, SaveFileResult, SaveAllFormsResult } from '../types';

/**
 * 데스크톱 환경 감지 (Tauri v2 또는 Electron)
 */
export function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return isTauri() || '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
  } catch {
    return false;
  }
}

export function isElectronEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.electronAPI?.isElectron && !isTauriEnvironment());
}

export function isDesktopApp(): boolean {
  return isTauriEnvironment() || isElectronEnvironment();
}

/**
 * 웹 환경에서 Blob 다운로드 유틸리티 (Fallback)
 */
export async function downloadFormWeb(fileName: string): Promise<void> {
  const encodedName = encodeURIComponent(fileName);
  const candidateUrls = [
    `./forms/${encodedName}`,
    `/forms/${encodedName}`,
    `forms/${encodedName}`,
  ];

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
        return;
      }
    } catch {
      // 다음 후보 경로 시도
    }
  }

  // 기본 a 태그 링크 fallback
  const link = document.createElement('a');
  link.href = `./forms/${encodedName}`;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 통합 데스크톱 브리지 구현체
 * Tauri v2 네이티브 Rust 커맨드 및 Electron 호환 레이어 제공
 */
export const desktopBridge: DesktopAPI = {
  get isDesktop(): boolean {
    return isDesktopApp();
  },
  get isTauri(): boolean {
    return isTauriEnvironment();
  },
  get isElectron(): boolean {
    return isElectronEnvironment();
  },
  get platform(): string {
    if (isTauriEnvironment()) return 'tauri-windows';
    if (window.electronAPI?.platform) return window.electronAPI.platform;
    return typeof navigator !== 'undefined' ? navigator.platform : 'web';
  },

  async getVersion(): Promise<string> {
    if (isTauriEnvironment()) {
      try {
        return await invoke<string>('get_app_version');
      } catch {
        return '1.0.0';
      }
    }
    if (window.electronAPI?.getVersion) {
      return await window.electronAPI.getVersion();
    }
    return '1.0.0';
  },

  async isPackaged(): Promise<boolean> {
    if (isTauriEnvironment()) return true;
    if (window.electronAPI?.isPackaged) {
      return await window.electronAPI.isPackaged();
    }
    return false;
  },

  async minimize(): Promise<void> {
    if (isTauriEnvironment()) {
      try {
        await getCurrentWindow().minimize();
        return;
      } catch (e) {
        console.warn('Tauri minimize error:', e);
      }
    }
    if (window.electronAPI?.minimize) {
      await window.electronAPI.minimize();
    }
  },

  async maximize(): Promise<void> {
    if (isTauriEnvironment()) {
      try {
        await getCurrentWindow().toggleMaximize();
        return;
      } catch (e) {
        console.warn('Tauri maximize error:', e);
      }
    }
    if (window.electronAPI?.maximize) {
      await window.electronAPI.maximize();
    }
  },

  async close(): Promise<void> {
    if (isTauriEnvironment()) {
      try {
        await getCurrentWindow().close();
        return;
      } catch (e) {
        console.warn('Tauri close error:', e);
      }
    }
    if (window.electronAPI?.close) {
      await window.electronAPI.close();
    }
  },

  async openExternal(url: string): Promise<void> {
    if (isTauriEnvironment()) {
      try {
        await invoke('open_external', { url });
        return;
      } catch {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
    }
    if (window.electronAPI?.openExternal) {
      await window.electronAPI.openExternal(url);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  },

  async openPath(path: string): Promise<void> {
    if (isTauriEnvironment()) {
      try {
        await invoke('open_path', { path });
        return;
      } catch (e) {
        console.warn('Tauri openPath error:', e);
      }
    }
    if (window.electronAPI?.openPath) {
      await window.electronAPI.openPath(path);
    }
  },

  async showItemInFolder(fullPath: string): Promise<void> {
    if (isTauriEnvironment()) {
      try {
        await invoke('show_item_in_folder', { fullPath });
        return;
      } catch (e) {
        console.warn('Tauri showItemInFolder error:', e);
      }
    }
    if (window.electronAPI?.showItemInFolder) {
      await window.electronAPI.showItemInFolder(fullPath);
    }
  },

  /**
   * 단일 서식 파일 저장:
   * 1. Tauri: Rust 네이티브 저장 다이얼로그 + 디스크 직접 쓰기
   * 2. Electron: IPC forms:saveSingle
   * 3. Web: 브라우저 Blob 다운로드
   */
  async saveFormFile(fileName: string): Promise<SaveFileResult> {
    if (isTauriEnvironment()) {
      try {
        const res = await invoke<SaveFileResult>('save_single_form', { fileName });
        return res;
      } catch (err: any) {
        console.error('Tauri save_single_form error:', err);
        return { success: false, error: err?.message || String(err) };
      }
    }

    if (window.electronAPI?.saveFormFile) {
      return await window.electronAPI.saveFormFile(fileName);
    }

    // Web 브라우저 다운로드
    try {
      await downloadFormWeb(fileName);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || '다운로드 실패' };
    }
  },

  /**
   * 5종 업무서식 일괄 저장:
   * 1. Tauri: Rust 네이티브 폴더 선택 다이얼로그 + 5종 동시 기록
   * 2. Electron: IPC forms:saveAll
   * 3. Web: 5종 순차 Blob 다운로드
   */
  async saveAllForms(fileNames: string[]): Promise<SaveAllFormsResult> {
    if (isTauriEnvironment()) {
      try {
        const res = await invoke<SaveAllFormsResult>('save_all_forms', { fileNames });
        return res;
      } catch (err: any) {
        console.error('Tauri save_all_forms error:', err);
        return { success: false, errors: [err?.message || String(err)] };
      }
    }

    if (window.electronAPI?.saveAllForms) {
      return await window.electronAPI.saveAllForms(fileNames);
    }

    // Web 브라우저 일괄 다운로드
    try {
      for (const name of fileNames) {
        await downloadFormWeb(name);
        await new Promise((r) => setTimeout(r, 350));
      }
      return {
        success: true,
        savedCount: fileNames.length,
        savedFiles: fileNames,
      };
    } catch (err: any) {
      return { success: false, errors: [err?.message || '다운로드 실패'] };
    }
  },
};

// 런타임 글로벌 노출 (Tauri 환경에서도 기존 window.electronAPI 호환성 100% 보장)
if (typeof window !== 'undefined') {
  window.desktopAPI = desktopBridge;
  if (!window.electronAPI && isTauriEnvironment()) {
    window.electronAPI = {
      isElectron: true, // 기존 코드 호환
      platform: 'tauri-windows',
      getVersion: () => desktopBridge.getVersion(),
      isPackaged: () => desktopBridge.isPackaged(),
      minimize: () => desktopBridge.minimize(),
      maximize: () => desktopBridge.maximize(),
      close: () => desktopBridge.close(),
      openExternal: (url) => desktopBridge.openExternal(url),
      openPath: (p) => desktopBridge.openPath(p),
      showItemInFolder: (fp) => desktopBridge.showItemInFolder(fp),
      showSaveDialog: async () => ({ canceled: false }),
      saveFormFile: (name) => desktopBridge.saveFormFile(name),
      saveAllForms: (names) => desktopBridge.saveAllForms(names),
    };
  }
}
