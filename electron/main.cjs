const { app, BrowserWindow, shell, ipcMain, Menu, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

const isDev = process.env.NODE_ENV === 'development' || 
              process.argv.includes('--dev') || 
              !app.isPackaged;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: '학교 기록물 관리 시스템',
    icon: path.join(__dirname, '../public/icon.png'),
    autoHideMenuBar: false,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false, // 로컬 HWPX/엑셀 파일 및 file:// 프로토콜 호환성 보장
    },
  });

  // 메뉴바 설정 (업무용 깔끔한 메뉴 구성)
  const template = [
    {
      label: '파일',
      submenu: [
        {
          label: '새로고침 (F5)',
          accelerator: 'F5',
          click: () => mainWindow && mainWindow.reload(),
        },
        { type: 'separator' },
        {
          label: '종료',
          accelerator: 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: '보기',
      submenu: [
        {
          label: '원래 크기로',
          accelerator: 'CmdOrCtrl+0',
          click: () => mainWindow && mainWindow.webContents.setZoomLevel(0),
        },
        {
          label: '확대',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            if (mainWindow) {
              const current = mainWindow.webContents.getZoomLevel();
              mainWindow.webContents.setZoomLevel(current + 0.5);
            }
          },
        },
        {
          label: '축소',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            if (mainWindow) {
              const current = mainWindow.webContents.getZoomLevel();
              mainWindow.webContents.setZoomLevel(current - 0.5);
            }
          },
        },
        { type: 'separator' },
        {
          label: '전체 화면',
          accelerator: 'F11',
          click: () => mainWindow && mainWindow.setFullScreen(!mainWindow.isFullScreen()),
        },
        {
          label: '개발자 도구 (F12)',
          accelerator: 'F12',
          click: () => mainWindow && mainWindow.webContents.toggleDevTools(),
        },
      ],
    },
    {
      label: '도움말',
      submenu: [
        {
          label: '프로그램 정보',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '학교 기록물 관리 시스템',
              message: '학교 기록물 관리 시스템 v1.0.0',
              detail: '학교 기록물 등록, 과제카드 추천, 상자 라벨 및 서식 다운로드 데스크톱 앱\n(Windows .exe 대응 Electron 빌드)',
              buttons: ['확인'],
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // 로딩 대상 결정: 개발 모드(localhost:3000) 또는 빌드된 dist/index.html
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (isDev && !app.isPackaged) {
    // 개발 모드이지만 URL 미지정 시: dist 파일이 있으면 로드, 없으면 로컬 서버 시도
    const distHtml = path.join(__dirname, '../dist/index.html');
    if (fs.existsSync(distHtml)) {
      mainWindow.loadFile(distHtml);
    } else {
      mainWindow.loadURL('http://localhost:3000');
    }
  } else {
    // 패키징된 프로덕션 앱
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // 외부 링크 클릭 시 기본 웹 브라우저로 오픈
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC 통신 핸들러 등록
ipcMain.handle('app:getVersion', () => app.getVersion());
ipcMain.handle('app:isPackaged', () => app.isPackaged);
ipcMain.handle('app:minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.minimize();
});
ipcMain.handle('app:maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});
ipcMain.handle('app:close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.close();
});
ipcMain.handle('shell:openExternal', async (_, url) => {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    await shell.openExternal(url);
  }
});
ipcMain.handle('dialog:showSaveDialog', async (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return await dialog.showSaveDialog(win, options);
});
ipcMain.handle('shell:openPath', async (_, targetPath) => {
  if (targetPath) {
    await shell.openPath(targetPath);
  }
});
ipcMain.handle('shell:showItemInFolder', async (_, fullPath) => {
  if (fullPath) {
    shell.showItemInFolder(fullPath);
  }
});

// 서식 파일 위치 검색 헬퍼 (asar 패키징, extraResources, 개발 환경 모두 지원)
function findFormFilePath(fileName) {
  const candidatePaths = [
    path.join(process.resourcesPath, 'forms', fileName),
    path.join(app.getAppPath(), 'dist/forms', fileName),
    path.join(app.getAppPath(), 'public/forms', fileName),
    path.join(__dirname, '../dist/forms', fileName),
    path.join(__dirname, '../public/forms', fileName),
    path.join(__dirname, 'dist/forms', fileName),
    path.join(process.cwd(), 'dist/forms', fileName),
    path.join(process.cwd(), 'public/forms', fileName),
  ];

  for (const candidate of candidatePaths) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch (e) {
      // ignore
    }
  }
  return null;
}

// 개별 서식 파일 저장 핸들러 (직접 Node.js fs 스트림 쓰기로 asar 가상경로 다운로드 실패 원천 방지)
ipcMain.handle('forms:saveSingle', async (event, fileName) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const srcPath = findFormFilePath(fileName);
  if (!srcPath) {
    return { success: false, error: `서식 원본 파일을 찾을 수 없습니다: ${fileName}` };
  }

  const ext = path.extname(fileName).slice(1) || 'hwpx';
  const saveResult = await dialog.showSaveDialog(win, {
    title: '서식 파일 다른 이름으로 저장',
    defaultPath: path.join(app.getPath('downloads'), fileName),
    filters: [
      { name: `한글 표준 문서 (*.${ext})`, extensions: [ext] },
      { name: '모든 파일 (*.*)', extensions: ['*'] },
    ],
  });

  if (saveResult.canceled || !saveResult.filePath) {
    return { success: false, canceled: true };
  }

  try {
    const data = fs.readFileSync(srcPath);
    fs.writeFileSync(saveResult.filePath, data);
    return { success: true, filePath: saveResult.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 전체 서식 5종 일괄 저장 핸들러 (폴더 선택 후 한 번에 모두 저장)
ipcMain.handle('forms:saveAll', async (event, fileNames) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const openResult = await dialog.showOpenDialog(win, {
    title: '업무서식 5종을 저장할 폴더를 선택하세요',
    defaultPath: app.getPath('downloads'),
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: '이 폴더에 저장',
  });

  if (openResult.canceled || !openResult.filePaths || openResult.filePaths.length === 0) {
    return { success: false, canceled: true };
  }

  const targetDir = openResult.filePaths[0];
  const savedFiles = [];
  const errors = [];

  for (const fileName of fileNames) {
    const srcPath = findFormFilePath(fileName);
    if (!srcPath) {
      errors.push(`${fileName} (원본 파일 없음)`);
      continue;
    }
    try {
      const data = fs.readFileSync(srcPath);
      const destPath = path.join(targetDir, fileName);
      fs.writeFileSync(destPath, data);
      savedFiles.push(fileName);
    } catch (err) {
      errors.push(`${fileName}: ${err.message}`);
    }
  }

  return {
    success: savedFiles.length > 0,
    folderPath: targetDir,
    savedCount: savedFiles.length,
    savedFiles,
    errors,
  };
});

// 단일 인스턴스 잠금 (중복 실행 방지)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    session.defaultSession.on('will-download', (event, item) => {
      item.once('done', (event, state) => {
        if (state === 'completed') {
          console.log('Download completed:', item.getSavePath());
        }
      });
    });

    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
