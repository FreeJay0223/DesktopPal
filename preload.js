const { contextBridge, ipcRenderer } = require('electron');

// 安全地暴露API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 配置相关
  getConfig: (key) => ipcRenderer.invoke('get-config', key),
  setConfig: (key, value) => ipcRenderer.invoke('set-config', key, value),
  getAllConfig: () => ipcRenderer.invoke('get-all-config'),
  
  // 屏幕信息（支持多屏）
  getScreenSize: () => ipcRenderer.invoke('get-screen-size'),
  getCurrentDisplay: () => ipcRenderer.invoke('get-current-display'),
  
  // 窗口控制
  setAlwaysOnTop: (value) => ipcRenderer.send('set-always-on-top', value),
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.send('set-ignore-mouse-events', ignore, options),
  setWindowSize: (size) => ipcRenderer.invoke('set-window-size', size),  // 返回 Promise，等窗口 resize 完成后 resolve
  
  // 系统信息
  platform: process.platform,
  
  // 模型重载事件
  onReloadModel: (callback) => ipcRenderer.on('reload-model', callback),
  removeReloadModelListener: () => ipcRenderer.removeAllListeners('reload-model'),
  
  // 播放动画事件
  onPlayAnim: (callback) => ipcRenderer.on('play-anim', (event, value) => callback(value)),
  removePlayAnimListener: () => ipcRenderer.removeAllListeners('play-anim'),
  
  // 聊天窗口
  closeChatWindow: () => ipcRenderer.send('close-chat-window'),
  minimizeChatWindow: () => ipcRenderer.send('minimize-chat-window'),
  triggerPetAction: (action) => ipcRenderer.send('trigger-pet-action', action),
  showChatBubble: (text) => ipcRenderer.send('chat-bubble', text),
  
  // 聊天动作事件（从聊天窗口转发来的动作指令）
  onChatAction: (callback) => ipcRenderer.on('chat-action', (event, action) => callback(action)),
  removeChatActionListener: () => ipcRenderer.removeAllListeners('chat-action'),

  // 聊天气泡事件（从聊天窗口同步 AI 回复到头顶）
  onChatBubble: (callback) => ipcRenderer.on('chat-bubble', (event, text) => callback(text)),
  removeChatBubbleListener: () => ipcRenderer.removeAllListeners('chat-bubble'),
  
  // 窗口大小（随模型 scale 联动）
  resizeWindow: (scale) => ipcRenderer.send('resize-window', scale),

  // 文件操作
  openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath)
});
