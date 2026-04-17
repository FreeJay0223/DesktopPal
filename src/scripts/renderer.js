// ==================== 全局状态 ====================
const state = {
  isDragging: false,
  dragOffset: { x: 0, y: 0 },
  wanderInterval: null,
  currentAnimation: 'idle',
  timer: {
    minutes: 25,
    seconds: 0,
    isRunning: false,
    interval: null
  },
  todos: [],
  chatHistory: [],
  config: {},
  // Live2D 相关
  live2dRenderer: null,
  // 智能图片动画
  smartImageAnimator: null,
  // GLTF 3D模型
  gltfRenderer: null,
  // 当前使用的模式
  petMode: 'svg' // 'svg' | 'live2d' | 'image' | 'gltf'
};

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Renderer] =========================================');
  console.log('[Renderer] 页面 DOM 加载完成，开始初始化');

  console.log('[Renderer] 加载配置...');
  await loadConfig();
  console.log('[Renderer] 配置加载完成');

  console.log('[Renderer] 初始化伙伴...');
  await initPet();
  console.log('[Renderer] 伙伴初始化完成');

  console.log('[Renderer] 初始化交互功能...');
  initDrag();
  initToolbar();
  initPanels();
  initWander();
  loadTodos();
  console.log('[Renderer] 交互功能初始化完成');


  // 监听模型重载事件
  window.electronAPI.onReloadModel(async () => {
    console.log('[Renderer] =========================================');
    console.log('[Renderer] 收到重新加载模型事件');
    try {
      await loadConfig();
      console.log('[Renderer] 配置已重新加载');
      console.log('[Renderer] 当前模型 ID:', state.config.currentLive2DModel);
      console.log('[Renderer] 模型列表:', state.config.live2dModels);
      await initPet();
      console.log('[Renderer] 模型重新加载完成');
    } catch (e) {
      console.error('[Renderer] 重新加载模型时出错:', e);
    }
    console.log('[Renderer] =========================================');
  });

  // 监听来自模型管理面板的动画播放指令
  window.electronAPI.onPlayAnim((cmd) => {
    console.log('[Renderer] 收到动画播放命令:', cmd);
    if (state.petMode === 'gltf' && state.gltfRenderer) {
      if (cmd.type === 'builtin' && typeof cmd.index === 'number') {
        console.log('[Renderer] 播放内置动画，索引:', cmd.index);
        state.gltfRenderer.playAnimation(cmd.index);
        showStatusBubble('🎬 ' + (cmd.name || '播放动画'), 1500);
      } else if (cmd.type === 'procedural') {
        console.log('[Renderer] 播放程序化动画:', cmd.name);
        state.gltfRenderer.playProceduralAction(cmd.name);
        showStatusBubble('🎬 ' + (cmd.name || '播放动画'), 1500);
      }
    } else if (state.petMode === 'live2d' && state.live2dRenderer && state.live2dRenderer.model) {
      console.log('[Renderer] 播放 Live2D 动作:', cmd.name || 'idle');
      state.live2dRenderer.model.motion(cmd.name || 'idle');
    }
  });

  // 监听来自聊天窗口的动作指令
  window.electronAPI.onChatAction((actionName) => {
    console.log('[Renderer] 收到聊天窗口动作指令:', actionName);
    executeAction(actionName);
  });

  // 监听来自聊天窗口的气泡文字（在模型头顶显示 AI 回复）
  window.electronAPI.onChatBubble((text) => {
    console.log('[Renderer] 收到聊天气泡:', text);
    const displayText = text.length > 50 ? text.substring(0, 50) + '...' : text;
    showChatBubble(displayText, 8000, true);
  });

  // 显示欢迎气泡
  console.log('[Renderer] 显示欢迎气泡');
  showStatusBubble('你好呀！🐶');
  console.log('[Renderer] =========================================');
});

// 加载配置
async function loadConfig() {
  console.log('[Renderer] 开始加载配置');
  state.config = await window.electronAPI.getAllConfig() || {};
  state.todos = state.config.todos || [];
  console.log('[Renderer] 配置加载完成，待办事项数量:', state.todos.length);
}

// ==================== 伙伴初始化 ====================
async function initPet() {
  console.log('[Renderer] =========================================');
  console.log('[Renderer] 开始初始化伙伴');

  // 先清理之前的渲染器
  console.log('[Renderer] 清理旧渲染器...');
  if (state.live2dRenderer) {
    console.log('[Renderer] 销毁 Live2D 渲染器');
    state.live2dRenderer.destroy();
    state.live2dRenderer = null;
  }
  if (state.smartImageAnimator) {
    console.log('[Renderer] 销毁智能图片动画器');
    state.smartImageAnimator.destroy();
    state.smartImageAnimator = null;
  }
  if (state.gltfRenderer) {
    console.log('[Renderer] 销毁 GLTF 渲染器');
    state.gltfRenderer.destroy();
    state.gltfRenderer = null;
  }

  // 获取模型配置
  const currentModelId = state.config.currentLive2DModel;
  const models = state.config.live2dModels || [];
  const currentModel = models.find(m => m.id === currentModelId);

  console.log('[Renderer] 当前模型 ID:', currentModelId);
  console.log('[Renderer] 可用模型数量:', models.length);
  console.log('[Renderer] 当前模型信息:', currentModel);

  // 根据模型类型加载
  if (currentModel) {
    console.log('[Renderer] 模型类型:', currentModel.type);
    console.log('[Renderer] 模型路径:', currentModel.path);
    console.log('[Renderer] 检查可用渲染器:');
    console.log('[Renderer]   GLTFRenderer:', !!window.GLTFRenderer);
    console.log('[Renderer]   loadThreeJS:', !!window.loadThreeJS);
    console.log('[Renderer]   Live2DRenderer:', !!window.Live2DRenderer);
    console.log('[Renderer]   SmartImageAnimator:', !!window.SmartImageAnimator);

    // GLTF 3D模型 - 尝试加载（即使GLTFRenderer还没加载）
    if (currentModel.type === 'GLTF' && currentModel.path) {
      try {
        console.log('[Renderer] 尝试加载 GLTF 3D 模型...');
        await initGLTF(currentModel);
        console.log('[Renderer] ✓ GLTF 模型加载成功');
        // 强制验证并修正对齐
        if (state.gltfRenderer && state.gltfRenderer.model) {
          state.gltfRenderer._verifyAlignment();
        }
        return;
      } catch (e) {
        console.error('[Renderer] ✗ GLTF 模型加载失败:', e);
      }
    }
    // Live2D模型
    if (currentModel.type === 'Live2D' && currentModel.path && window.Live2DRenderer) {
      try {
        console.log('[Renderer] 尝试加载 Live2D 模型...');
        await initLive2D(currentModel);
        console.log('[Renderer] ✓ Live2D 模型加载成功');
        return;
      } catch (e) {
        console.error('[Renderer] ✗ Live2D 模型加载失败:', e);
      }
    }
    // 静态图片模型
    if (currentModel.type === 'Image' && currentModel.path && window.SmartImageAnimator) {
      try {
        console.log('[Renderer] 尝试加载静态图片模型...');
        initSmartImage(currentModel);
        console.log('[Renderer] ✓ 静态图片模型加载成功');
        return;
      } catch (e) {
        console.error('[Renderer] ✗ 静态图片模型加载失败:', e);
      }
    }
  }
  
  // 回退到SVG
  initSVG();
}

// 初始化GLTF 3D模型
async function initGLTF(model) {
  const svgContainer   = document.getElementById('svg-container');
  const live2dContainer = document.getElementById('live2d-container');
  const petEl          = document.getElementById('pet');
  
  console.log('initGLTF: Loading Three.js...');
  
  // 动态加载Three.js
  if (window.loadThreeJS) {
    try {
      await window.loadThreeJS();
      console.log('initGLTF: Three.js + GLTFLoader loaded');
    } catch (e) {
      console.error('initGLTF: Failed to load Three.js:', e);
      throw e;
    }
  }
  
  if (!window.GLTFRenderer) {
    console.error('initGLTF: GLTFRenderer not available');
    throw new Error('GLTFRenderer not loaded');
  }
  
  if (!window.THREE || !THREE.GLTFLoader) {
    console.error('initGLTF: THREE.GLTFLoader not available');
    throw new Error('THREE.GLTFLoader not loaded');
  }
  
  console.log('initGLTF: Creating 3D container...');
  
  // 恢复 #pet-container 原始大小
  const petContainer = document.getElementById('pet-container');
  petContainer.style.width = '';
  petContainer.style.height = '';
  petContainer.style.right = '';
  petContainer.style.bottom = '';
  console.log('[Renderer] initGLTF: 恢复 pet-container 原始样式');
  
  // 将 gltf-container 放在 #pet 内部
  let gltfContainer = document.getElementById('gltf-container');
  if (!gltfContainer) {
    gltfContainer = document.createElement('div');
    gltfContainer.id = 'gltf-container';
    petEl.appendChild(gltfContainer);
  }

  // #pet-container 已经通过 CSS 铺满窗口 (320x320)，无需手动设置

  // gltf-container 铺满 #pet
  gltfContainer.style.cssText = [
    'width: 100%',
    'height: 100%',
    'position: absolute',
    'top: 0',
    'left: 0',
    'display: block'
  ].join('; ') + ';';
  
  console.log('[Renderer] initGLTF: pet-container 尺寸:', petContainer.offsetWidth, 'x', petContainer.offsetHeight);
  console.log('[Renderer] initGLTF: gltf-container 尺寸:', gltfContainer.offsetWidth, 'x', gltfContainer.offsetHeight);
  
  console.log('initGLTF: Initializing renderer...');
  
  state.gltfRenderer = new GLTFRenderer(gltfContainer);
  await state.gltfRenderer.init();
  
  // 从配置中读取模型显示大小
  const modelDisplaySize = state.config.modelDisplaySize || 0.2;
  console.log('initGLTF: Loading model from:', model.path, 'displaySize:', modelDisplaySize);
  await state.gltfRenderer.loadModel(model.path, modelDisplaySize);

  // 启用调试模式以观察动画播放时的模型边界变化
  state.gltfRenderer.setDebugMode(true);

  // 启动自动动画切换
  state.gltfRenderer.startAutoAnimation();

  // 调试：在控制台暴露调试方法
  window.debugModel = () => {
    const r = state.gltfRenderer;
    const box = new THREE.Box3().setFromObject(r.model);
    console.log('===== 模型调试信息 =====');
    console.log('窗口大小:', window.innerWidth, 'x', window.innerHeight);
    console.log('相机位置:', r.camera.position);
    console.log('模型位置:', r.model.position);
    console.log('模型缩放:', r.model.scale);
    console.log('模型边界 box.min:', box.min);
    console.log('模型边界 box.max:', box.max);
    console.log('模型底部实际y:', box.min.y);
    console.log('========================');
  };
  
  window.toggleDebugBackground = () => {
    const body = document.body;
    if (body.style.background === 'rgba(255, 100, 100, 0.3)') {
      body.style.background = 'transparent';
      console.log('[调试] 已移除红色背景');
    } else {
      body.style.background = 'rgba(255, 100, 100, 0.3)';
      console.log('[调试] 已添加红色半透明背景');
    }
  };
  
  // 重新对齐模型底部到窗口底部
  window.realignModel = () => {
    const r = state.gltfRenderer;
    if (!r || !r.model) {
      console.log('[调试] 没有加载模型');
      return;
    }
    const box = new THREE.Box3().setFromObject(r.model);
    const currentBottom = box.min.y;
    console.log('[调试] 当前模型底部 y:', currentBottom.toFixed(4));
    
    if (Math.abs(currentBottom) > 0.001) {
      r.model.position.y -= currentBottom;
      const newBox = new THREE.Box3().setFromObject(r.model);
      console.log('[调试] ✓ 已修正，新底部 y:', newBox.min.y.toFixed(4));
    } else {
      console.log('[调试] ✓ 模型已对齐');
    }
  };
  
  console.log('[Renderer] 调试模式：可在控制台执行以下命令:');
  console.log('  - debugModel() 查看模型信息');
  console.log('  - toggleDebugBackground() 切换红色背景');
  console.log('  - realignModel() 重新对齐模型底部');
  
  // 保存动画信息到 config，供模型管理面板读取
  const animList = state.gltfRenderer.getAnimationList();
  const actionList = state.gltfRenderer.getAvailableActions();
  await window.electronAPI.setConfig('modelAnimInfo', {
    animations: animList,
    actions: actionList,
    hasSkeleton: state.gltfRenderer.hasSkeleton,
    boneCount: Object.keys(state.gltfRenderer.bones || {}).length
  });
  
  // 隐藏其他容器，显示3D容器
  svgContainer.style.display    = 'none';
  live2dContainer.style.display = 'none';
  gltfContainer.style.display   = 'block';
  state.petMode = 'gltf';
  
  console.log('initGLTF: Model loaded successfully, mode:', state.petMode);
}

// 初始化Live2D
async function initLive2D(model) {
  const container = document.getElementById('live2d-container');
  const svgContainer = document.getElementById('svg-container');
  const gltfContainer = document.getElementById('gltf-container');

  // 恢复 #pet-container 原始大小
  const petContainer = document.getElementById('pet-container');
  petContainer.style.width = '';
  petContainer.style.height = '';
  petContainer.style.right = '';
  petContainer.style.bottom = '';

  // 隐藏 GLTF 容器
  if (gltfContainer) gltfContainer.style.display = 'none';
  
  // 检查必要的库是否加载
  if (typeof PIXI === 'undefined' || !window.Live2DRenderer) {
    throw new Error('Live2D libraries not loaded');
  }
  
  state.live2dRenderer = new Live2DRenderer(container);
  await state.live2dRenderer.init();
  await state.live2dRenderer.loadModel(model.path);
  
  // 设置眼睛跟踪
  state.live2dRenderer.setupEyeTracking(document.body);
  
  // 设置模型加载回调
  state.live2dRenderer.onModelLoaded = (m) => {
    console.log('Live2D model loaded successfully');
  };
  
  // 显示Live2D容器，隐藏其他
  container.style.display = 'block';
  svgContainer.style.display = 'none';
  state.petMode = 'live2d';
}

// 初始化智能图片动画
function initSmartImage(model) {
  const container = document.getElementById('svg-container');
  const live2dContainer = document.getElementById('live2d-container');
  const gltfContainer = document.getElementById('gltf-container');

  // 恢复 #pet-container 原始大小
  const petContainer = document.getElementById('pet-container');
  petContainer.style.width = '';
  petContainer.style.height = '';
  petContainer.style.right = '';
  petContainer.style.bottom = '';

  // 隐藏 GLTF 容器
  if (gltfContainer) gltfContainer.style.display = 'none';
  if (!window.SmartImageAnimator) {
    throw new Error('SmartImageAnimator not loaded');
  }
  
  state.smartImageAnimator = new SmartImageAnimator(container);
  state.smartImageAnimator.loadImage(model.path);
  
  // 显示SVG容器，隐藏Live2D
  container.style.display = 'block';
  live2dContainer.style.display = 'none';
  state.petMode = 'image';
}

// 初始化SVG
function initSVG() {
  const container = document.getElementById('svg-container');
  const live2dContainer = document.getElementById('live2d-container');
  const gltfContainer = document.getElementById('gltf-container');
  
  // 恢复 #pet-container 原始大小
  const petContainer = document.getElementById('pet-container');
  petContainer.style.width = '';
  petContainer.style.height = '';
  petContainer.style.right = '';
  petContainer.style.bottom = '';

  // 隐藏 GLTF 容器
  if (gltfContainer) gltfContainer.style.display = 'none';

  container.innerHTML = createDogSVG();
  live2dContainer.style.display = 'none';
  state.petMode = 'svg';
  
  // 添加动画状态切换
  setInterval(() => {
    if (!state.isDragging && state.petMode === 'svg' && Math.random() < 0.1) {
      const animations = ['idle', 'happy', 'blink', 'wag'];
      const nextAnim = animations[Math.floor(Math.random() * animations.length)];
      setAnimation(nextAnim);
    }
  }, 3000);
}

// 创建狗狗SVG
function createDogSVG() {
  return `
    <svg viewBox="0 0 200 200" class="dog-svg">
      <defs>
        <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#f4a460"/>
          <stop offset="100%" style="stop-color:#d2691e"/>
        </linearGradient>
        <linearGradient id="earGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#cd853f"/>
          <stop offset="100%" style="stop-color:#8b4513"/>
        </linearGradient>
      </defs>
      
      <!-- 尾巴 -->
      <g class="tail">
        <path d="M160,120 Q180,100 175,80 Q170,60 160,70" 
              fill="url(#bodyGradient)" stroke="#8b4513" stroke-width="2"/>
      </g>
      
      <!-- 身体 -->
      <ellipse cx="100" cy="120" rx="60" ry="45" fill="url(#bodyGradient)"/>
      
      <!-- 后腿 -->
      <ellipse cx="60" cy="155" rx="15" ry="25" fill="url(#bodyGradient)"/>
      <ellipse cx="140" cy="155" rx="15" ry="25" fill="url(#bodyGradient)"/>
      
      <!-- 前腿 -->
      <ellipse cx="75" cy="158" rx="12" ry="22" fill="url(#bodyGradient)"/>
      <ellipse cx="125" cy="158" rx="12" ry="22" fill="url(#bodyGradient)"/>
      
      <!-- 头 -->
      <circle cx="100" cy="70" r="45" fill="url(#bodyGradient)"/>
      
      <!-- 耳朵 -->
      <g class="ears">
        <ellipse cx="60" cy="50" rx="20" ry="35" fill="url(#earGradient)" 
                 transform="rotate(-15, 60, 50)"/>
        <ellipse cx="140" cy="50" rx="20" ry="35" fill="url(#earGradient)" 
                 transform="rotate(15, 140, 50)"/>
      </g>
      
      <!-- 脸部 -->
      <!-- 眼睛 -->
      <g class="eyes">
        <circle cx="80" cy="65" r="10" fill="white"/>
        <circle cx="120" cy="65" r="10" fill="white"/>
        <circle cx="82" cy="65" r="6" fill="#333" class="pupil"/>
        <circle cx="122" cy="65" r="6" fill="#333" class="pupil"/>
        <circle cx="84" cy="63" r="2" fill="white"/>
        <circle cx="124" cy="63" r="2" fill="white"/>
      </g>
      
      <!-- 鼻子 -->
      <ellipse cx="100" cy="85" rx="12" ry="8" fill="#333"/>
      <ellipse cx="100" cy="83" rx="4" ry="2" fill="#666"/>
      
      <!-- 嘴巴 -->
      <g class="mouth">
        <path d="M90,95 Q100,105 110,95" stroke="#333" stroke-width="2" fill="none"/>
      </g>
      
      <!-- 舌头 (隐藏，开心时显示) -->
      <ellipse cx="100" cy="105" rx="8" ry="12" fill="#ff6b6b" class="tongue" style="display:none"/>
      
      <!-- 眉毛 (隐藏，表情时显示) -->
      <g class="eyebrows" style="display:none">
        <line x1="70" y1="52" x2="90" y2="55" stroke="#8b4513" stroke-width="3" stroke-linecap="round"/>
        <line x1="130" y1="55" x2="110" y2="52" stroke="#8b4513" stroke-width="3" stroke-linecap="round"/>
      </g>
    </svg>
    
    <style>
      .dog-svg {
        width: 100%;
        height: 100%;
      }
      
      .tail {
        transform-origin: 160px 120px;
        animation: wagTail 0.3s ease-in-out infinite alternate;
      }
      
      @keyframes wagTail {
        from { transform: rotate(-10deg); }
        to { transform: rotate(15deg); }
      }
      
      .ears {
        animation: earWiggle 2s ease-in-out infinite;
      }
      
      @keyframes earWiggle {
        0%, 100% { transform: rotate(0deg); }
        50% { transform: rotate(3deg); }
      }
      
      .pupil {
        animation: lookAround 4s ease-in-out infinite;
      }
      
      @keyframes lookAround {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(2px); }
        75% { transform: translateX(-2px); }
      }
      
      /* 开心状态 */
      .dog-svg.happy .mouth path {
        d: path("M85,95 Q100,115 115,95");
      }
      
      .dog-svg.happy .tongue {
        display: block;
      }
      
      /* 眨眼状态 */
      .dog-svg.blink .eyes {
        animation: blink 0.2s ease-in-out;
      }
      
      @keyframes blink {
        0%, 100% { transform: scaleY(1); }
        50% { transform: scaleY(0.1); }
      }
    </style>
  `;
}

function setAnimation(anim) {
  const svg = document.querySelector('.dog-svg');
  if (!svg) return;
  
  svg.classList.remove('idle', 'happy', 'blink', 'wag');
  svg.classList.add(anim);
  
  state.currentAnimation = anim;
  
  // 3秒后恢复idle
  if (anim !== 'idle') {
    setTimeout(() => {
      svg.classList.remove(anim);
      svg.classList.add('idle');
    }, 3000);
  }
}

// ==================== 状态气泡 / 对话气泡 ====================
let bubbleTimer = null;

/**
 * 显示状态气泡（短文本，如"让我想想..."、"摸摸我~"）
 */
function showStatusBubble(text, duration = 2000) {
  showChatBubble(text, duration);
}

/**
 * 显示对话气泡（角色头上的文字气泡，支持多行，带打字效果）
 * @param {string} text - 显示的文本
 * @param {number} duration - 显示时长(ms)，0 表示一直显示直到下次调用
 * @param {boolean} typing - 是否启用打字效果
 */
function showChatBubble(text, duration = 4000, typing = false) {
  const bubble = document.getElementById('status-bubble');
  const textEl = document.getElementById('status-text');

  // 清除上一个定时器
  if (bubbleTimer) {
    clearTimeout(bubbleTimer);
    bubbleTimer = null;
  }

  // 移除打字效果相关 class
  bubble.classList.remove('typing');

  if (typing && text.length > 2) {
    // 打字效果
    textEl.textContent = '';
    bubble.classList.remove('hidden');
    bubble.classList.add('typing');
    let i = 0;
    const typeInterval = setInterval(() => {
      if (i < text.length) {
        textEl.textContent += text[i];
        i++;
      } else {
        clearInterval(typeInterval);
        bubble.classList.remove('typing');
        // 打字完成后设置自动消失
        if (duration > 0) {
          bubbleTimer = setTimeout(() => {
            bubble.classList.add('hidden');
            bubbleTimer = null;
          }, duration);
        }
      }
    }, 40);
  } else {
    textEl.textContent = text;
    bubble.classList.remove('hidden');
    if (duration > 0) {
      bubbleTimer = setTimeout(() => {
        bubble.classList.add('hidden');
        bubbleTimer = null;
      }, duration);
    }
  }
}

// ==================== 拖拽功能 ====================
function initDrag() {
  const pet = document.getElementById('pet');
  let dragStartWindowWidth = 0;
  let dragStartWindowHeight = 0;

  pet.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // 只响应左键

    // 记录拖动开始时的窗口大小
    dragStartWindowWidth = window.innerWidth;
    dragStartWindowHeight = window.innerHeight;

    // 使用窗口坐标（不是显示器坐标）计算偏移
    state.isDragging = true;
    state.dragOffset = {
      x: e.screenX - window.screenX,
      y: e.screenY - window.screenY
    };
    console.log('[Renderer] 开始拖动，偏移:', state.dragOffset, '窗口大小:', dragStartWindowWidth, 'x', dragStartWindowHeight);
    
    // 锁定 GLTF 渲染器的 ResizeObserver
    if (state.gltfRenderer && state.gltfRenderer._lockResize !== undefined) {
      state.gltfRenderer._lockResize = true;
      console.log('[Renderer] 已锁定 ResizeObserver');
    }
    
    pet.classList.add('dragging');
    stopWander();
  });

  document.addEventListener('mousemove', (e) => {
    if (!state.isDragging) return;

    const newX = e.screenX - state.dragOffset.x;
    const newY = e.screenY - state.dragOffset.y;

    // 移动窗口
    window.moveTo(newX, newY);
    
    // 强制保持窗口大小不变（防止某些情况下窗口被意外调整）
    if (window.innerWidth !== dragStartWindowWidth || window.innerHeight !== dragStartWindowHeight) {
      console.log('[Renderer] ⚠️ 检测到窗口大小变化，强制恢复:', window.innerWidth, 'x', window.innerHeight, '->', dragStartWindowWidth, 'x', dragStartWindowHeight);
      // Electron 的 window.setSize 可能会改变位置，所以先保存当前位置
      const currentX = window.screenX;
      const currentY = window.screenY;
      window.setSize(dragStartWindowWidth, dragStartWindowHeight);
      window.moveTo(currentX, currentY);
    }
  });

  document.addEventListener('mouseup', () => {
    if (state.isDragging) {
      const finalWidth = window.innerWidth;
      const finalHeight = window.innerHeight;
      console.log('[Renderer] 拖动结束，窗口大小:', finalWidth, 'x', finalHeight);
      
      // 如果窗口大小发生了变化，记录警告
      if (finalWidth !== dragStartWindowWidth || finalHeight !== dragStartWindowHeight) {
        console.warn('[Renderer] ⚠️ 窗口大小异常变化:', dragStartWindowWidth, 'x', dragStartWindowHeight, '->', finalWidth, 'x', finalHeight);
      }
      
      // 解锁 GLTF 渲染器的 ResizeObserver
      if (state.gltfRenderer && state.gltfRenderer._lockResize !== undefined) {
        state.gltfRenderer._lockResize = false;
        console.log('[Renderer] 已解锁 ResizeObserver');
        
        // 手动更新一次渲染器大小
        const w = state.gltfRenderer.container.clientWidth || 160;
        const h = state.gltfRenderer.container.clientHeight || 160;
        state.gltfRenderer.renderer.setSize(w, h);
        state.gltfRenderer.camera.aspect = w / h;
        state.gltfRenderer.camera.updateProjectionMatrix();
        
        // 更新相机 y 位置，保持 y=0 平面对齐窗口底部
        const fovRad = (60 * Math.PI) / 180;
        const dist = 10;
        const visibleHeight = 2 * dist * Math.tan(fovRad / 2);
        state.gltfRenderer.camera.position.y = visibleHeight / 2;
        state.gltfRenderer.camera.lookAt(0, visibleHeight / 2, 0);
        
        console.log('[Renderer] 手动更新渲染器大小:', w, 'x', h, '相机 y:', (visibleHeight / 2).toFixed(4));
      }
      
      state.isDragging = false;
      pet.classList.remove('dragging');
      // 松开鼠标后不自动启动漫游
      // startWander();
    }
  });
  
  // 悬停效果（带防抖，3秒内不重复触发）
  let lastHoverTime = 0;
  pet.addEventListener('mouseenter', () => {
    const now = Date.now();
    if (now - lastHoverTime < 3000) return;
    lastHoverTime = now;

    // 触发AI主动说话
    triggerAIProactiveChat();
  });

  // 双击跳舞
  pet.addEventListener('dblclick', (e) => {
    if (state.petMode === 'gltf' && state.gltfRenderer) {
      state.gltfRenderer.playProceduralAction('dance');
      showStatusBubble('💃 跳起来啦~', 2000);
    } else {
      setAnimation('happy');
      showStatusBubble('开心~', 1000);
    }
  });
}

// ==================== 工具栏交互 ====================
function initToolbar() {
  const toolbar = document.getElementById('toolbar');
  if (!toolbar) return;

  // 工具栏按钮点击
  toolbar.querySelectorAll('.toolbar-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      if (action) {
        handleMenuAction(action);
      }
    });
  });
}

function handleMenuAction(action) {
  switch (action) {
    case 'chat':
      window.electronAPI.setConfig('openChatWindow', true);
      break;
    case 'todo':
      showPanel('todo-panel');
      break;
    case 'timer':
      showPanel('timer-panel');
      break;
    case 'quick':
      showPanel('quick-panel');
      break;
    case 'translate':
      showPanel('translate-panel');
      break;
    case 'models':
      window.electronAPI.setConfig('openModelManager', true);
      break;
    case 'settings':
      window.electronAPI.setConfig('openSettings', true);
      break;
    case 'hide':
      showStatusBubble('我去休息啦~');
      setTimeout(() => window.close(), 1000);
      break;
  }
}

// ==================== 面板功能 ====================
function initPanels() {
  // 关闭按钮
  document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const panelId = btn.dataset.panel;
      hidePanel(panelId);
    });
  });
  
  initChat();
  initTodo();
  initTimer();
  initQuick();
  initTranslate();
}

function showPanel(panelId) {
  // 先隐藏所有面板
  document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));

  const panel = document.getElementById(panelId);
  panel.classList.remove('hidden');
  // 位置由CSS控制，不再需要JS设置
}

function hidePanel(panelId) {
  document.getElementById(panelId).classList.add('hidden');
}

// ==================== 性格系统 ====================

/**
 * 构建系统提示词（替换称呼占位符）
 */
function buildSystemPrompt() {
  const config = state.config;
  const petName = config.petName || '小伙伴';
  const userName = config.userName || '朋友';
  const source = config.personaSource || 'skill';

  let systemPrompt;

  if (source === 'skill' && config.skillFileContent) {
    systemPrompt = config.skillFileContent;
  } else if (source === 'custom' && config.customSystemPrompt) {
    systemPrompt = config.customSystemPrompt;
  } else {
    // 无配置时使用基础提示
    systemPrompt = '你是' + petName + '，一个桌面伙伴。你的朋友叫' + userName + '。';
  }

  // 追加动作指令 - 精简版，放置靠前
  const actionHint = `## 动作规则
你可以在回复末尾加 [动作:动画名] 让角色做动作。动作标记不会显示给用户。
**情绪 → 动作参考：**
- 开心庆祝：Victory / Jumping Jacks / Victory Fist Pump
- 愤怒/不满：Angry / Reject
- 困惑/疑惑：Confused / Dizzy
- 疲惫/困：Tired / Meditate / Tired Hunched
- 问候/打招呼：Greeting / Bow / Head Nod
- 同意/肯定：Head Nod / Yes
- 否定/拒绝：Reject
- 思考/倾听：Idle Listening / Idle
- 说话：Idle_Talking_Loop
- 蹦跳：Jump_Loop / Jump_Land / NinjaJump_Idle_Loop
- 跳舞：Dance_Loop / Dance Body Roll / Dance Charleston
- 惊讶：Backflip / Jump_Start
- 冥想/打坐：Meditate
- 走路/跑步：Walk_Loop / Jog_Fwd_Loop / Run Anime
- 睡觉：Sleeping
- 后空翻：Backflip
- 僵尸：Zombie_Idle_Loop / Zombie_Walk_Fwd_Loop
- 拳击/打架：Punch_Jab / Punch_Cross / Fighting Idle
- 施法：Spell_Simple_Enter / Spell_Simple_Shoot
- 悬浮：Levitate Entrance / Levitate Idle
- 充能：Power Up
- 游泳：Swim_Idle_Loop / Swim_Fwd_Loop
- 开车：Driving_Loop
- 举盾：Idle_Shield_Loop / Idle_Shield_Break
- 持剑：Sword_Idle / Sword_Attack / Sword_Regular_A / Sword_Regular_B / Sword_Regular_C
- 持枪：Pistol_Idle_Loop / Pistol_Shoot / Pistol_Reload
- 农场：Farm_PlantSeed / Farm_Watering / Farm_Harvest
- 砍树：TreeChopping_Loop
- 僵尸挠人：Zombie_Scratch
动作要自然，不要每句都加，根据情绪选择最贴合的。
`;

  systemPrompt += '\n\n---\n\n' + actionHint;

  // 替换占位符
  systemPrompt = systemPrompt.replace(/\{petName\}/g, petName).replace(/\{userName\}/g, userName);

  // 注入当前模型的可用动作列表（追加到提示词末尾）
  if (state.petMode === 'gltf' && state.gltfRenderer) {
    const animList = state.gltfRenderer.getAnimationList();
    const actions = state.gltfRenderer.getAvailableActions();
    if (animList.length > 0 || actions.length > 0) {
      let extraHint = '\n\n当前模型已加载的内置动画列表（优先使用这些）：\n';
      animList.forEach((a, i) => { extraHint += '- [动作:' + a.name + ']\n'; });
      actions.filter(a => a.type === 'procedural').forEach(a => { extraHint += '- 程序化: [动作:' + a.name + ']\n'; });
      systemPrompt += extraHint;
    }
  }

  return systemPrompt;
}

/**
 * 从AI回复中解析 [动作:xxx] 标记
 * @returns {{ text: string, action: string|null }}
 */
function parseActionFromResponse(response) {
  console.log('[parseAction] 原始回复:', response);
  // 匹配 [动作:xxx] 或 [action:xxx]，兼容全角/半角冒号
  const actionMatch = response.match(/\[(?:动作|action)[:：]\s*([^\]]+)\]/i);
  if (actionMatch) {
    const action = actionMatch[1].trim();
    // 去掉动作标记：必须和匹配用同一个正则结构
    const text = response.replace(/\[(?:动作|action)[:：]\s*[^\]]+\]/gi, '').trim();
    console.log('[parseAction] ✅ 解析到动作:', action, '| 清理后文本:', text);
    return { text, action };
  }
  console.log('[parseAction] ℹ️ 未检测到动作标记');
  return { text: response, action: null };
}

// ==================== 聊天功能 ====================
function initChat() {
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  const messages = document.getElementById('chat-messages');

  // 加载历史消息
  if (state.chatHistory.length === 0 && state.config.chatHistory) {
    state.chatHistory = state.config.chatHistory || [];
    // 渲染历史消息（最多显示最近20条）
    const recentHistory = state.chatHistory.slice(-20);
    recentHistory.forEach(msg => {
      addMessage(msg.role, msg.content, false);
    });
  }

  // 更新 placeholder 显示称呼
  const petName = state.config.petName || '小伙伴';
  input.placeholder = '对 ' + petName + ' 说点什么...';
  
  const sendMessage = async () => {
    const text = input.value.trim();
    if (!text) return;

    // 保存用户消息到历史
    state.chatHistory.push({ role: 'user', content: text });
    // 保留最近50轮对话
    if (state.chatHistory.length > 100) {
      state.chatHistory = state.chatHistory.slice(-100);
    }
    // 持久化
    window.electronAPI.setConfig('chatHistory', state.chatHistory);

    addMessage('user', text);
    input.value = '';

    // 角色头上显示"思考中"
    showChatBubble('让我想想...', 0);

    try {
      const response = await callAI(text);
      const { text: cleanText, action } = parseActionFromResponse(response);

      addMessage('ai', cleanText);

      // 保存 AI 回复到历史（用 cleanText，去掉动作标签）
      state.chatHistory.push({ role: 'assistant', content: cleanText });
      if (state.chatHistory.length > 100) {
        state.chatHistory = state.chatHistory.slice(-100);
      }
      window.electronAPI.setConfig('chatHistory', state.chatHistory);

      // 角色头上显示回复（带打字效果）
      const displayText = cleanText.length > 50 ? cleanText.substring(0, 50) + '...' : cleanText;
      showChatBubble(displayText, 6000, true);

      // 执行动作
      if (action && state.petMode === 'gltf' && state.gltfRenderer) {
        executeAction(action);
      } else if (action && state.petMode === 'live2d' && state.live2dRenderer && state.live2dRenderer.model) {
        state.live2dRenderer.model.motion(action);
      } else if (action && state.petMode === 'image' && state.smartImageAnimator) {
        state.smartImageAnimator.playAnimationByText(action);
      } else if (state.petMode !== 'gltf') {
        // SVG 或其他模式的 fallback
        setAnimation('happy');
      }
    } catch (error) {
      console.error('Chat error:', error);
      addMessage('ai', '抱歉，我遇到了一些问题。请检查API配置。');
      showChatBubble('出错了...', 2000);
    }
  };

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
}

function addMessage(role, text, saveToHistory = true) {
  const messages = document.getElementById('chat-messages');
  const msg = document.createElement('div');
  msg.className = 'message ' + role;

  // 显示角色名
  const petName = state.config.petName || '小伙伴';
  const userName = state.config.userName || '朋友';
  const nameEl = document.createElement('div');
  nameEl.className = 'message-name';
  nameEl.textContent = role === 'user' ? userName : petName;
  msg.appendChild(nameEl);

  const contentEl = document.createElement('div');
  contentEl.className = 'message-content';
  contentEl.textContent = text;
  msg.appendChild(contentEl);

  messages.appendChild(msg);
  messages.scrollTop = messages.scrollHeight;
}

/**
 * 执行动作指令（支持内置动画名和程序化动作名）
 */
function executeAction(actionName) {
  console.log('[executeAction] 收到动作指令:', actionName);

  if (!state.gltfRenderer) {
    console.warn('[executeAction] ❌ gltfRenderer 未初始化，petMode:', state.petMode);
    return;
  }

  // 立即打断当前动画（fadeOut 时间缩短到 0.05s）
  if (state.gltfRenderer.currentAction) {
    state.gltfRenderer.currentAction.fadeOut(0.05);
    state.gltfRenderer.currentAction = null;
    console.log('[executeAction] ⏹ 已打断当前动画');
  }
  // 同时清除程序化动画
  state.gltfRenderer._stopAllProcedural();

  const animList = state.gltfRenderer.getAnimationList();
  const actions = state.gltfRenderer.getAvailableActions();
  console.log('[executeAction] 可用内置动画:', animList.map(a => a.name));
  console.log('[executeAction] 可用程序化动作:', actions.filter(a => a.type === 'procedural').map(a => a.name));

  // 先尝试匹配内置动画名（精确 → 包含关系）
  const builtinMatch = animList.findIndex(a =>
    a.name.toLowerCase() === actionName.toLowerCase() ||
    a.name.toLowerCase().includes(actionName.toLowerCase()) ||
    actionName.toLowerCase().includes(a.name.toLowerCase())
  );

  if (builtinMatch >= 0) {
    state.gltfRenderer.playAnimation(builtinMatch);
    console.log('[executeAction] ✅ 播放内置动画:', animList[builtinMatch].name, '(index:', builtinMatch, ')');
    return;
  }

  // 再尝试匹配程序化动作名
  const procMatch = actions.find(a =>
    a.name.toLowerCase() === actionName.toLowerCase() ||
    a.name.toLowerCase().includes(actionName.toLowerCase()) ||
    actionName.toLowerCase().includes(a.name.toLowerCase())
  );

  if (procMatch) {
    if (procMatch.type === 'procedural') {
      state.gltfRenderer.playProceduralAction(procMatch.name);
      console.log('[executeAction] ✅ 播放程序化动作:', procMatch.name);
    } else {
      state.gltfRenderer.playAnimation(procMatch.index);
      console.log('[executeAction] ✅ 播放动作 (index):', procMatch.name);
    }
    return;
  }

  // 模糊匹配（动作关键词映射）
  const fuzzyMap = {
    '跳': 'jump', '蹦': 'jump', '蹦跳': 'jump',
    '转': 'spin', '旋转': 'spin',
    '摇': 'wiggle', '摇摆': 'wiggle', '扭': 'wiggle',
    '舞': 'dance', '跳舞': 'dance',
    '摇头': 'shakeHead', '不': 'shakeHead',
    '点头': 'nod', '是': 'nod', '好': 'nod',
    '挥手': 'wave', '打招呼': 'wave',
    '鼓掌': 'clap', '掌声': 'clap'
  };

  for (const [keyword, procName] of Object.entries(fuzzyMap)) {
    if (actionName.includes(keyword)) {
      state.gltfRenderer.playProceduralAction(procName);
      console.log('[executeAction] ✅ 模糊匹配动作:', procName, '(关键词:', keyword, ', 原始:', actionName, ')');
      return;
    }
  }

  console.warn('[executeAction] ❌ 未找到匹配动作:', actionName, '| 请检查动画名是否存在于上方列表中');
}

async function callAI(text) {
  console.log('[Renderer] =========================================');
  console.log('[Renderer] 开始调用 AI API');
  console.log('[Renderer] 用户输入:', text);

  // 每次调用前刷新配置，确保包含最新动作提示词
  await loadConfig();
  const config = state.config;
  console.log('[Renderer] API 配置:');
  console.log('[Renderer]   端点:', config.apiEndpoint);
  console.log('[Renderer]   模型:', config.model);
  console.log('[Renderer]   API Key:', config.apiKey ? '***已设置***' : '未设置');

  if (!config.apiKey || !config.apiEndpoint) {
    console.warn('[Renderer] API 配置不完整');
    return '请先在设置中配置API信息哦~ 点击右键菜单的设置进行配置。';
  }

  try {
    // 构建消息列表：system + 历史对话 + 当前消息
    const systemPrompt = buildSystemPrompt();
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // 添加历史对话（最近10轮，避免 token 过长）
    const recentHistory = state.chatHistory.slice(-20);
    console.log('[Renderer] 历史对话轮数:', recentHistory.length);
    recentHistory.forEach(msg => {
      messages.push({ role: msg.role, content: msg.content });
    });

    // 添加当前用户消息
    messages.push({ role: 'user', content: text });
    console.log('[Renderer] 总消息数量:', messages.length);

    console.log('[Renderer] 发送 API 请求...');
    const response = await fetch(config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + config.apiKey
      },
      body: JSON.stringify({
        model: config.model || 'gpt-3.5-turbo',
        messages: messages
      })
    });

    console.log('[Renderer] 收到 API 响应, 状态码:', response.status);
    const data = await response.json();

    if (!data.choices || !data.choices[0]) {
      console.error('[Renderer] API 返回格式异常:', data);
      throw new Error('API 返回格式异常');
    }

    const aiResponse = data.choices[0].message.content;
    console.log('[Renderer] ✓ AI 响应成功, 长度:', aiResponse.length);
    console.log('[Renderer] AI 回复:', aiResponse);
    console.log('[Renderer] =========================================');
    return aiResponse;
  } catch (error) {
    console.error('[Renderer] ✗ API 调用失败:', error);
    console.log('[Renderer] =========================================');
    throw error;
  }
}

/**
 * 触发AI主动说话（当用户鼠标悬停在模型上时）
 */
async function triggerAIProactiveChat() {
  console.log('[Renderer] 触发AI主动说话');

  // 播放互动动作
  if (state.petMode === 'gltf' && state.gltfRenderer) {
    const actions = state.gltfRenderer.getAvailableActions();
    if (actions.length > 0) {
      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      if (randomAction.type === 'procedural') {
        state.gltfRenderer.playProceduralAction(randomAction.name);
      } else {
        state.gltfRenderer.playAnimation(randomAction.index);
      }
    }
  } else {
    setAnimation('happy');
  }

  // 检查API配置
  const config = state.config;
  if (!config.apiKey || !config.apiEndpoint) {
    console.log('[Renderer] API未配置，显示配置提示');
    // 丰富的提示语池，引导用户配置API
    const noApiPrompts = [
      '想和我聊天吗？快去设置里配置API吧~',
      '我还不会说话呢，去设置里帮我配置一下API吧！',
      '配置好API我就能陪你聊天啦~快去设置看看！',
      '想听我说什么？去设置里配置API试试看~',
      '我有很多话想和你说，先去设置配置API吧！',
      '嘘~悄悄告诉你，配置API后我就能说话啦！',
      '主人~去设置里配置API，我就能和你聊天了！',
      '快去设置里填上API，我就能开口说话啦~',
      '我已经准备好啦，就差API配置了！去看看设置吧~',
      '想要我主动找你聊天吗？配置好API就可以了哦~'
    ];
    const randomPrompt = noApiPrompts[Math.floor(Math.random() * noApiPrompts.length)];
    showStatusBubble(randomPrompt, 3000);
    return;
  }

  // 显示思考中
  showChatBubble('...', 0);

  try {
    // 丰富的场景提示词池
    const proactivePrompts = [
      '用户刚刚把鼠标移到你身上，像是在轻轻摸你。请主动说一句简短可爱的话回应。',
      '用户靠近了你，你想和他打个招呼，说一句温馨的话。',
      '用户正在看着你，你想分享一下自己现在的心情，简短自然地表达。',
      '用户刚刚注意到你了，你想问问他最近怎么样，一句话即可。',
      '用户来到你身边，你想给他一些小鼓励，简短温暖地说。',
      '用户轻轻触碰了你，你想表达一下被关注的小开心，一句话。',
      '用户正在陪伴你，你想分享一个小想法或小愿望，简短地说。',
      '用户靠近了，你想告诉他一件小事，随意自然的语气。',
      '用户看着你，你想分享此刻的小心情，轻松可爱地说出来。',
      '用户在你身边，你想问问他今天有什么有趣的计划，简短地聊。',
      '用户轻轻互动了一下，你想撒个娇或者卖个萌，一句话表达。',
      '用户陪伴着你，你想分享一个小发现或小惊喜，简短自然。',
      '用户走近了，你想提醒他注意休息或者喝口水，温暖地说。',
      '用户在旁边，你想分享一句喜欢的话或者小感悟，简短表达。',
      '用户轻轻点触你，你想说一句调皮或者俏皮的话回应。'
    ];

    // 随机选择一个场景提示
    const proactivePrompt = proactivePrompts[Math.floor(Math.random() * proactivePrompts.length)];
    console.log('[Renderer] 选中场景:', proactivePrompt);

    const response = await callAI(proactivePrompt);
    const { text: cleanText, action } = parseActionFromResponse(response);

    // 显示AI的回复（带打字效果）
    const displayText = cleanText.length > 50 ? cleanText.substring(0, 50) + '...' : cleanText;
    showChatBubble(displayText, 4000, true);

    // 执行动作
    if (action && state.petMode === 'gltf' && state.gltfRenderer) {
      executeAction(action);
    }
  } catch (error) {
    console.error('[Renderer] AI主动说话失败:', error);
    // 失败时不显示固定语句，静默处理
    showChatBubble('...', 1000);
  }
}

// ==================== 待办功能 ====================
function initTodo() {
  const input = document.getElementById('todo-input');
  const addBtn = document.getElementById('todo-add');
  
  addBtn.addEventListener('click', () => addTodo(input.value));
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTodo(input.value);
  });
}

function loadTodos() {
  renderTodos();
}

function addTodo(text) {
  text = text.trim();
  if (!text) return;
  
  state.todos.push({
    id: Date.now(),
    text,
    completed: false,
    createdAt: new Date().toISOString()
  });
  
  saveTodos();
  renderTodos();
  
  document.getElementById('todo-input').value = '';
  showStatusBubble('已添加待办！');
}

function toggleTodo(id) {
  const todo = state.todos.find(t => t.id === id);
  if (todo) {
    todo.completed = !todo.completed;
    saveTodos();
    renderTodos();
  }
}

function deleteTodo(id) {
  state.todos = state.todos.filter(t => t.id !== id);
  saveTodos();
  renderTodos();
}

function saveTodos() {
  window.electronAPI.setConfig('todos', state.todos);
}

function renderTodos() {
  const list = document.getElementById('todo-list');
  list.innerHTML = state.todos.map(todo => `
    <div class="todo-item ${todo.completed ? 'completed' : ''}">
      <input type="checkbox" ${todo.completed ? 'checked' : ''} 
             onchange="toggleTodo(${todo.id})">
      <span class="todo-text">${todo.text}</span>
      <button class="delete-todo" onclick="deleteTodo(${todo.id})">×</button>
    </div>
  `).join('');
}

// ==================== 番茄钟功能 ====================
function initTimer() {
  const display = document.getElementById('timer-display');
  const startBtn = document.getElementById('timer-start');
  const pauseBtn = document.getElementById('timer-pause');
  const resetBtn = document.getElementById('timer-reset');
  
  startBtn.addEventListener('click', startTimer);
  pauseBtn.addEventListener('click', pauseTimer);
  resetBtn.addEventListener('click', resetTimer);
  
  // 预设按钮
  document.querySelectorAll('.timer-presets button').forEach(btn => {
    btn.addEventListener('click', () => {
      const minutes = parseInt(btn.dataset.minutes);
      state.timer.minutes = minutes;
      state.timer.seconds = 0;
      updateTimerDisplay();
    });
  });
}

function updateTimerDisplay() {
  const display = document.getElementById('timer-display');
  const m = String(state.timer.minutes).padStart(2, '0');
  const s = String(state.timer.seconds).padStart(2, '0');
  display.textContent = `${m}:${s}`;
}

function startTimer() {
  if (state.timer.isRunning) return;
  
  state.timer.isRunning = true;
  showStatusBubble('开始专注！');
  setAnimation('happy');
  
  state.timer.interval = setInterval(() => {
    if (state.timer.seconds > 0) {
      state.timer.seconds--;
    } else if (state.timer.minutes > 0) {
      state.timer.minutes--;
      state.timer.seconds = 59;
    } else {
      // 时间到
      pauseTimer();
      showStatusBubble('专注完成！休息一下吧~', 5000);
      if (state.petMode === 'gltf' && state.gltfRenderer) {
        state.gltfRenderer.playProceduralAction('jump');
      } else {
        setAnimation('happy');
      }
      // 可以添加声音提醒
      return;
    }
    updateTimerDisplay();
  }, 1000);
}

function pauseTimer() {
  state.timer.isRunning = false;
  clearInterval(state.timer.interval);
}

function resetTimer() {
  pauseTimer();
  state.timer.minutes = 25;
  state.timer.seconds = 0;
  updateTimerDisplay();
}

// ==================== 快捷操作 ====================
function initQuick() {
  document.querySelectorAll('.quick-item').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      handleQuickAction(action);
    });
  });
}

function handleQuickAction(action) {
  const actions = {
    'open-notepad': 'notepad.exe',
    'open-calculator': 'calc.exe',
    'open-explorer': 'explorer.exe',
    'open-browser': 'start msedge'
  };
  
  if (actions[action]) {
    showStatusBubble('好的！');
    // 通过ipc发送命令
    window.electronAPI.setConfig('executeCommand', actions[action]);
  }
}

// ==================== 翻译功能 ====================
function initTranslate() {
  const input = document.getElementById('translate-input');
  const translateBtn = document.getElementById('translate-btn');
  const summarizeBtn = document.getElementById('summarize-btn');
  const result = document.getElementById('translate-result');
  
  translateBtn.addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text) return;
    
    result.textContent = '翻译中...';
    try {
      const response = await callAI(`请翻译以下内容为中文（如果已经是中文则翻译为英文）：\n\n${text}`);
      result.textContent = response;
    } catch (error) {
      result.textContent = '翻译失败，请检查API配置。';
    }
  });
  
  summarizeBtn.addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text) return;
    
    result.textContent = '总结中...';
    try {
      const response = await callAI(`请用简洁的语言总结以下内容：\n\n${text}`);
      result.textContent = response;
    } catch (error) {
      result.textContent = '总结失败，请检查API配置。';
    }
  });
}

// ==================== 自动漫游 ====================
function initWander() {
  // 默认关闭漫游，用户可通过设置开启
  // startWander();
}

function startWander() {
  if (state.wanderInterval) return;

  state.wanderInterval = setInterval(async () => {
    if (state.isDragging) return;

    // 获取当前显示器信息（支持多屏）
    const display = await window.electronAPI.getCurrentDisplay();
    if (!display) return;

    const { x: displayX, y: displayY, width, height } = display;
    const [currentX, currentY] = [window.screenX, window.screenY];

    // 小幅度随机漂移（每2秒最多移动10px，更自然）
    const dx = (Math.random() - 0.5) * 20;
    const dy = (Math.random() - 0.5) * 20;

    let newX = currentX + dx;
    let newY = currentY + dy;

    // 获取实际窗口尺寸做边界检测
    const [windowWidth, windowHeight] = window.innerWidth ? [window.innerWidth, window.innerHeight] : [250, 360];
    newX = Math.max(displayX + 5, Math.min(displayX + width - windowWidth - 5, newX));
    newY = Math.max(displayY + 5, Math.min(displayY + height - windowHeight - 5, newY));

    window.moveTo(Math.round(newX), Math.round(newY));
  }, 3000); // 改为3秒一次，减少频率
}

function stopWander() {
  clearInterval(state.wanderInterval);
  state.wanderInterval = null;
}

// 全局函数暴露
window.toggleTodo = toggleTodo;
window.deleteTodo = deleteTodo;
