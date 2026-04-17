const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeTheme, shell, dialog, nativeImage, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');

// ===== 日志文件系统 =====
// 注意：打包后 __dirname 指向 asar 包内部（只读），必须使用 app.getPath('userData') 获取可写目录
const LOG_TO_FILE = true; // 设置为 false 可禁用文件日志
let logFilePath = null;

// 确保日志目录存在（在 app ready 后初始化）
function initLogFile() {
  const logDir = path.join(app.getPath('userData'), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  logFilePath = path.join(logDir, 'app.log');
}

// 日志函数
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

function logToFile(level, ...args) {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => {
    if (typeof arg === 'object') {
      return JSON.stringify(arg);
    }
    return String(arg);
  }).join(' ');

  const logLine = `[${timestamp}] [${level}] ${message}\n`;

  // 写入文件（始终 UTF-8）
  if (LOG_TO_FILE && logFilePath) {
    try {
      fs.appendFileSync(logFilePath, logLine, 'utf8');
    } catch (e) {
      // 静默失败，避免循环
    }
  }

  // 同时也输出到控制台（可能乱码，但文件中是正常的）
  originalConsoleLog(`[${timestamp}] [${level}]`, ...args);
}

// 重写 console 方法
console.log = function(...args) { logToFile('INFO', ...args); };
console.error = function(...args) { logToFile('ERROR', ...args); };
console.warn = function(...args) { logToFile('WARN', ...args); };

// 启动时清空日志文件（在 initLogFile 之后调用）
function clearLogFile() {
  if (LOG_TO_FILE && logFilePath) {
    try {
      fs.writeFileSync(logFilePath, '', 'utf8');
      console.log('========================================');
      console.log('日志文件已清空，开始新日志');
      console.log('日志文件位置:', logFilePath);
      console.log('========================================');
    } catch (e) {
      // 忽略错误
    }
  }
}

// 持久化存储
const store = new Store();

console.log('[Main] =========================================');
console.log('[Main] Desktop Friend 主进程启动');
console.log('[Main] 持久化存储已初始化');

// ===== 全局错误处理 - 程序报错时自动退出 =====
process.on('uncaughtException', (error) => {
  console.error('[Main] 未捕获的异常:', error);
  console.error('[Main] 程序将退出...');
  
  // 给用户一点时间看到错误（如果有控制台）
  setTimeout(() => {
    app.quit();
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Main] 未处理的Promise拒绝:', reason);
  console.error('[Main] 程序将退出...');
  
  // 给用户一点时间看到错误（如果有控制台）
  setTimeout(() => {
    app.quit();
    process.exit(1);
  }, 1000);
});

// Allow loading local file:// resources (needed for GLTF models & textures)
app.commandLine.appendSwitch('allow-file-access-from-files');
app.commandLine.appendSwitch('disable-web-security');
// 禁用 High DPI 缩放，避免窗口大小计算错误
app.commandLine.appendSwitch('high-dpi-support', '1');
app.commandLine.appendSwitch('force-device-scale-factor', '1');
console.log('[Main] 命令行参数已设置: allow-file-access-from-files, disable-web-security, high-dpi-support=1, force-device-scale-factor=1');

let mainWindow = null;
let tray = null;
let isQuiting = false;

// 创建主窗口
function createWindow() {
  console.log('[Main] 创建主窗口');
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const savedPosition = store.get('windowPosition', { x: width - 220, y: height - 220 });
  const savedWindowSize = store.get('windowSize', 350);
  console.log('[Main] 屏幕尺寸:', width, 'x', height);
  console.log('[Main] 保存的位置:', savedPosition);
  console.log('[Main] 保存的窗口大小:', savedWindowSize);

  mainWindow = new BrowserWindow({
    width: savedWindowSize,
    height: savedWindowSize,
    x: Math.min(savedPosition.x, width - savedWindowSize),
    y: Math.min(savedPosition.y, height - savedWindowSize),
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false // Allow loading local file:// resources (needed for GLTF/GLB models)
    }
  });

  // 监控窗口大小变化（调试用）
  let lastSize = mainWindow.getSize();
  mainWindow.on('resize', () => {
    const newSize = mainWindow.getSize();
    console.log('[Main] 窗口大小变化:', lastSize[0], 'x', lastSize[1], '->', newSize[0], 'x', newSize[1]);
    lastSize = newSize;
  });

  console.log('[Main] 主窗口创建完成，加载 index.html');
  
  // 开发模式：禁用缓存，确保加载最新文件
  if (process.env.NODE_ENV !== 'production') {
    mainWindow.webContents.session.clearCache().then(() => {
      console.log('[Main] 开发模式：已清除缓存');
    });
    // 默认不打开调试窗口，需要时按 Ctrl+Shift+I 手动打开
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
  
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // 防止窗口被关闭（最小化到托盘）
  mainWindow.on('close', (event) => {
    if (!isQuiting) {
      console.log('[Main] 主窗口关闭请求，最小化到托盘');
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });

  mainWindow.on('closed', () => {
    console.log('[Main] 主窗口已关闭');
    mainWindow = null;
  });

  // 记住位置
  mainWindow.on('moved', () => {
    const [x, y] = mainWindow.getPosition();
    store.set('windowPosition', { x, y });
    console.log('[Main] 主窗口位置已保存:', x, y);
  });

  // 注册快捷键：Ctrl+Shift+I 或 F12 打开独立开发者工具
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.key === 'i' && input.control && input.shift) || input.key === 'F12') {
      event.preventDefault();
      mainWindow.webContents.openDevTools({ mode: 'detach' });
      console.log('[Main] 打开开发者工具（独立窗口）');
    }
  });
}

// 创建系统托盘
function createTray() {
  console.log('[Main] 创建系统托盘');
  
  try {
    // 优先使用 .ico 文件（Windows 推荐格式），其次使用 .png
    let iconPath = path.join(__dirname, 'assets', 'icon.ico');
    let iconExists = fs.existsSync(iconPath);
    
    console.log('[Main] 检查 icon.ico:', iconPath, '存在:', iconExists);
    
    if (!iconExists) {
      iconPath = path.join(__dirname, 'assets', 'icon.png');
      iconExists = fs.existsSync(iconPath);
      console.log('[Main] 检查 icon.png:', iconPath, '存在:', iconExists);
    }

    // 如果图标都不存在，创建一个默认图标
    if (!iconExists) {
      console.log('[Main] 托盘图标不存在，创建默认图标');
      createDefaultIcon(iconPath);
    }

    // 创建托盘图标
    let iconImage = nativeImage.createFromPath(iconPath);
    
    // 如果图标为空，尝试创建默认图标
    if (iconImage.isEmpty()) {
      console.warn('[Main] 图标为空，尝试创建默认图标');
      createDefaultIcon(iconPath);
      iconImage = nativeImage.createFromPath(iconPath);
    }
    
    // Windows 托盘图标通常使用 16x16 或 32x32
    const trayIcon = process.platform === 'win32' 
      ? iconImage.resize({ width: 16, height: 16 }) 
      : iconImage;
    
    tray = new Tray(trayIcon);
    console.log('[Main] 托盘图标创建成功');
    
    // 设置托盘菜单
    const contextMenu = Menu.buildFromTemplate([
      { label: '显示伙伴', click: () => {
          console.log('[Main] 托盘菜单: 显示伙伴');
          mainWindow?.show();
        }},
      { label: '设置', click: () => {
          console.log('[Main] 托盘菜单: 打开设置');
          openSettings();
        }},
      { type: 'separator' },
      { label: '退出', click: () => {
          console.log('[Main] 托盘菜单: 退出应用');
          isQuiting = true;
          app.quit();
        }}
    ]);

    tray.setToolTip('桌面伙伴');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
      console.log('[Main] 托盘双击，显示主窗口');
      mainWindow?.show();
    });
  } catch (error) {
    console.error('[Main] 创建托盘图标失败:', error);
    // 不要因为托盘失败而退出程序
  }
}

// 创建默认图标
function createDefaultIcon(iconPath) {
  try {
    const fs = require('fs');
    const dir = path.dirname(iconPath);
    
    // 检查父目录是否存在，如果不存在则创建
    if (!fs.existsSync(dir)) {
      console.log('[Main] 创建图标目录:', dir);
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // 创建一个简单的PNG图标 (16x16 橙色圆点)
    const simpleIcon = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR length and type
      0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x10, // 16x16
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x91, 0x68, // bit depth, color type
      0x36, // IHDR CRC
      0x00, 0x00, 0x00, 0x01, 0x73, 0x52, 0x47, 0x42, // sRGB
      0x00, 0xAE, 0xCE, 0x1C, 0xE9,
      0x00, 0x00, 0x00, 0x44, 0x49, 0x44, 0x41, 0x54, // IDAT
      0x78, 0x9C, 0x62, 0xFC, 0xDF, 0xD5, 0xD5, 0x0D,
      0x00, 0x08, 0x10, 0x03, 0x00, 0x01, 0x49, 0x52,
      0x24, 0xB0, 0xE5, 0x4F, 0x80, 0x00, 0x00, 0x00,
      0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60,
      0x82
    ]);
    
    fs.writeFileSync(iconPath, simpleIcon);
    console.log('[Main] 默认图标创建成功:', iconPath);
  } catch (error) {
    console.error('[Main] 创建默认图标失败:', error);
    // 不要抛出错误，让程序继续运行
  }
}

// 打开聊天窗口
let chatWindow = null;
function openChatWindow() {
  console.log('[Main] 打开聊天窗口');
  if (chatWindow) {
    console.log('[Main] 聊天窗口已存在，显示并聚焦');
    chatWindow.show();
    chatWindow.focus();
    return;
  }

  chatWindow = new BrowserWindow({
    width: 420,
    height: 580,
    parent: null,
    modal: false,
    title: '与伙伴聊天',
    autoHideMenuBar: true,
    resizable: true,
    minWidth: 320,
    minHeight: 400,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false
    }
  });

  chatWindow.loadFile(path.join(__dirname, 'src', 'chat-window.html'));
  chatWindow.on('closed', () => {
    console.log('[Main] 聊天窗口已关闭');
    chatWindow = null;
  });
}

// 打开设置窗口
let settingsWindow = null;
function openSettings() {
  console.log('[Main] 打开设置窗口');
  if (settingsWindow) {
    console.log('[Main] 设置窗口已存在，聚焦');
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 480,
    height: 720,
    parent: null,
    modal: false,
    title: '伙伴设置',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  settingsWindow.loadFile(path.join(__dirname, 'src', 'settings.html'));
  settingsWindow.on('closed', () => {
    console.log('[Main] 设置窗口已关闭');
    settingsWindow = null;
  });
}

// 打开模型管理窗口
let modelManagerWindow = null;
function openModelManager() {
  console.log('[Main] 打开模型管理窗口');
  if (modelManagerWindow) {
    console.log('[Main] 模型管理窗口已存在，聚焦');
    modelManagerWindow.focus();
    return;
  }

  modelManagerWindow = new BrowserWindow({
    width: 500,
    height: 650,
    parent: null,
    modal: false,
    title: '形象管理',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false // Allow loading local file:// resources
    }
  });

  modelManagerWindow.loadFile(path.join(__dirname, 'src', 'model-manager.html'));
  // 调试窗口已移除，需要时按 Ctrl+Shift+I 手动打开
  // modelManagerWindow.webContents.openDevTools({ mode: 'detach' });
  modelManagerWindow.on('closed', () => {
    console.log('[Main] 模型管理窗口已关闭，通知主窗口重新加载模型');
    modelManagerWindow = null;
    // 通知主窗口重新加载模型
    if (mainWindow) {
      mainWindow.webContents.send('reload-model');
    }
  });
}

// IPC 通信
ipcMain.handle('get-config', (event, key) => {
  const value = store.get(key);
  console.log('[IPC] get-config:', key, '=', value);
  return value;
});

ipcMain.handle('set-config', (event, key, value) => {
  console.log('[IPC] set-config:', key, '=', value);
  store.set(key, value);

  // 特殊处理
  if (key === 'autoStart') {
    console.log('[IPC] 设置开机自启:', value);
    app.setLoginItemSettings({
      openAtLogin: value,
      path: app.getPath('exe')
    });
  }

  if (key === 'openSettings') {
    console.log('[IPC] 打开设置窗口');
    openSettings();
  }

  if (key === 'openModelManager') {
    console.log('[IPC] 打开模型管理窗口');
    openModelManager();
  }

  if (key === 'executeCommand') {
    console.log('[IPC] 执行命令:', value);
    executeCommand(value);
  }

  if (key === 'reloadModel') {
    console.log('[IPC] 重新加载模型');
    // 通知主窗口重新加载模型
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('reload-model');
    }
  }

  if (key === 'openChatWindow') {
    console.log('[IPC] 打开聊天窗口');
    openChatWindow();
  }

  if (key === 'playAnimCommand') {
    console.log('[IPC] 播放动画命令:', value);
    // 从模型管理面板触发播放动画
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('play-anim', value);
    }
  }

  return true;
});

ipcMain.handle('get-all-config', () => {
  return store.store;
});

// 打开文件选择对话框（用于导入 skill.md）
ipcMain.handle('open-file-dialog', async (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { canceled: true };
  const result = await dialog.showOpenDialog(win, {
    title: options?.title || '选择文件',
    filters: options?.filters || [{ name: 'Skill 文件', extensions: ['md', 'txt'] }, { name: '所有文件', extensions: ['*'] }],
    properties: ['openFile']
  });
  return result;
});

// 读取文件内容
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 获取屏幕信息（支持多屏）
ipcMain.handle('get-screen-size', () => {
  const displays = screen.getAllDisplays();
  return displays.map(d => ({
    id: d.id,
    x: d.bounds.x,
    y: d.bounds.y,
    width: d.workAreaSize.width,
    height: d.workAreaSize.height,
    workArea: d.workArea
  }));
});

// 获取当前窗口所在的显示器
ipcMain.handle('get-current-display', () => {
  if (!mainWindow) return null;
  const [winX, winY] = mainWindow.getPosition();
  const display = screen.getDisplayNearestPoint({ x: winX, y: winY });
  return {
    id: display.id,
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.workAreaSize.width,
    height: display.workAreaSize.height,
    workArea: display.workArea
  };
});

// 聊天窗口控制
ipcMain.on('close-chat-window', () => {
  if (chatWindow) chatWindow.close();
});

ipcMain.on('minimize-chat-window', () => {
  if (chatWindow) chatWindow.minimize();
});

// 聊天窗口触发伙伴动作（转发到主窗口）
ipcMain.on('trigger-pet-action', (event, action) => {
  if (mainWindow) {
    mainWindow.webContents.send('chat-action', action);
  }
});

// 聊天气泡同步（聊天窗口→主窗口头顶气泡）
ipcMain.on('chat-bubble', (event, text) => {
  if (mainWindow) {
    mainWindow.webContents.send('chat-bubble', text);
  }
});

// 窗口控制
ipcMain.on('set-always-on-top', (event, value) => {
  mainWindow?.setAlwaysOnTop(value);
});

ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  mainWindow?.setIgnoreMouseEvents(ignore, options || { forward: true });
});

// 根据模型 scale 调整主窗口大小（兼容旧的 send 方式 + 新的 Promise 方式）
ipcMain.handle('set-window-size', async (event, size) => {
  if (!mainWindow) return;
  const MIN = 250;
  const MAX = 1200;
  const finalSize = Math.round(Math.max(MIN, Math.min(MAX, size)));
  const [curX, curY] = mainWindow.getPosition();
  const [curW, curH] = mainWindow.getSize();
  const newX = Math.round(curX + (curW - finalSize) / 2);
  const newY = Math.round(curY + (curH - finalSize) / 2);
  mainWindow.setSize(finalSize, finalSize);
  mainWindow.setPosition(newX, newY);
  console.log('[set-window-size] size:', finalSize, 'px');
  // 等窗口真正 resize 完成（让渲染进程有时间响应容器尺寸变化）
  await new Promise(r => setTimeout(r, 150));
  return finalSize;
});

// 执行命令
function executeCommand(cmd) {
  console.log('[Main] 执行系统命令:', cmd);
  const { exec } = require('child_process');
  exec(cmd, (error) => {
    if (error) {
      console.error('[Main] 命令执行失败:', error);
    } else {
      console.log('[Main] 命令执行成功');
    }
  });
}

// 应用启动
app.whenReady().then(() => {
  // 先初始化日志系统
  initLogFile();
  clearLogFile();
  
  console.log('[Main] =========================================');
  console.log('[Main] 应用已就绪，开始初始化窗口');
  console.log('[Main] 日志文件位置:', logFilePath);
  
  // 检查是否是首次运行（或重置配置）
  const isFirstRun = !store.has('initialized');
  if (isFirstRun) {
    console.log('[Main] 首次运行，清空所有配置...');
    // 清空 API 配置
    store.delete('apiKey');
    store.delete('apiEndpoint');
    store.delete('apiProvider');
    store.delete('model');
    // 清空性格设定配置
    store.delete('petName');
    store.delete('userName');
    store.delete('personaSource');
    store.delete('customSystemPrompt');
    store.delete('skillFileContent');
    store.delete('skillFileName');
    store.delete('personaPreset');
    
    // 设置默认模型（如果存在）
    // 打包后模型在 resources/models/，开发时在 models/
    let defaultModelPath;
    if (app.isPackaged) {
      // 打包后：使用 resources 目录
      defaultModelPath = path.join(path.dirname(app.getPath('exe')), 'resources', 'models', 'men_all.glb');
    } else {
      // 开发时：使用项目根目录
      defaultModelPath = path.join(__dirname, 'models', 'men_all.glb');
    }
    
    console.log('[Main] 检查默认模型路径:', defaultModelPath);
    
    if (fs.existsSync(defaultModelPath)) {
      console.log('[Main] 检测到默认模型，设置默认配置');
      const defaultModelId = 'default-model-' + Date.now();
      const defaultModel = {
        id: defaultModelId,
        name: '默认人物模型',
        type: 'GLTF',
        path: defaultModelPath,
        addedAt: new Date().toISOString()
      };
      
      // 设置模型列表和当前模型
      store.set('live2dModels', [defaultModel]);
      store.set('currentLive2DModel', defaultModelId);
      console.log('[Main] 默认模型已设置:', defaultModelPath);
    } else {
      console.log('[Main] 未找到默认模型，清空模型配置');
      store.delete('currentLive2DModel');
      store.delete('live2dModels');
    }
    
    // 标记为已初始化
    store.set('initialized', true);
    console.log('[Main] 所有配置已清空，用户需要重新设置 API');
  }
  
  createWindow();
  createTray();

  // 开机自启
  const autoStart = store.get('autoStart', true);
  console.log('[Main] 开机自启设置:', autoStart);
  app.setLoginItemSettings({
    openAtLogin: autoStart,
    path: app.getPath('exe')
  });
  console.log('[Main] =========================================');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  isQuiting = true;
});