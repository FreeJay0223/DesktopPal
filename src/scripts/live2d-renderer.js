/**
 * Live2D 渲染模块 (浏览器兼容版本)
 * 支持 moc3 格式的 Live2D Cubism 3/4 模型
 * 依赖: pixi.min.js, live2d.min.js, pixi-live2d-display.min.js
 */

class Live2DRenderer {
  constructor(container) {
    this.container = container;
    this.app = null;
    this.model = null;
    this.currentModelPath = null;
    this.motionTimer = null;
    this.isInteracting = false;
    this.onModelLoaded = null;
    this.onMotionPlay = null;
  }

  /**
   * 初始化 PixiJS 应用
   */
  async init() {
    console.log('[Live2DRenderer] 初始化 Live2D 渲染器');
    // 确保 PIXI 可用
    if (typeof PIXI === 'undefined') {
      console.error('[Live2DRenderer] PIXI.js 未加载');
      throw new Error('PIXI.js not loaded');
    }

    // 创建 PixiJS 应用
    console.log('[Live2DRenderer] 创建 PIXI 应用 (160x160)');
    this.app = new PIXI.Application({
      width: 160,
      height: 160,
      backgroundAlpha: 0,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    });

    this.container.appendChild(this.app.view);
    console.log('[Live2DRenderer] PIXI view 已添加到容器');

    // 等待渲染器准备就绪
    await new Promise(resolve => {
      if (this.app.renderer) {
        console.log('[Live2DRenderer] 渲染器已就绪');
        resolve();
      } else {
        this.app.renderer.on('ready', resolve);
      }
    });

    console.log('[Live2DRenderer] Live2D 渲染器初始化完成');
    return true;
  }

  /**
   * 加载 Live2D 模型
   * @param {string} modelPath - 模型 .model3.json 文件路径
   */
  async loadModel(modelPath) {
    console.log('[Live2DRenderer] 开始加载 Live2D 模型:', modelPath);
    try {
      // 清理旧模型
      if (this.model) {
        console.log('[Live2DRenderer] 清理旧模型');
        this.app.stage.removeChild(this.model);
        if (this.model.destroy) {
          this.model.destroy();
        }
        this.model = null;
      }

      // 检查是否是本地文件路径
      if (modelPath.startsWith('file://') || !modelPath.startsWith('http')) {
        // 使用 file:// 协议
        if (!modelPath.startsWith('file://')) {
          modelPath = 'file:///' + modelPath.replace(/\\/g, '/');
        }
      }
      console.log('[Live2DRenderer] 模型路径已转换为:', modelPath);

      // 加载新模型
      console.log('[Live2DRenderer] 正在加载模型文件...');
      this.model = await PIXI.live2d.Live2DModel.from(modelPath, {
        autoInteract: false
      });
      console.log('[Live2DRenderer] 模型加载成功');

      // 设置模型属性
      console.log('[Live2DRenderer] 设置模型属性: scale=0.2, anchor=0.5');
      this.model.scale.set(0.2);
      this.model.anchor.set(0.5, 0.5);
      this.model.x = this.app.screen.width / 2;
      this.model.y = this.app.screen.height / 2 + 20;

      // 添加到舞台
      this.app.stage.addChild(this.model);
      console.log('[Live2DRenderer] 模型已添加到舞台');

      // 启动自动动作
      console.log('[Live2DRenderer] 启动待机动作');
      this.startIdleMotion();

      this.currentModelPath = modelPath;

      // 绑定交互事件
      console.log('[Live2DRenderer] 设置交互事件');
      this.setupInteractions();

      // 回调
      if (this.onModelLoaded) {
        this.onModelLoaded(this.model);
      }

      console.log('[Live2DRenderer] ✓ Live2D 模型加载完成:', modelPath);
      return true;
    } catch (error) {
      console.error('[Live2DRenderer] ✗ Live2D 模型加载失败:', error);
      throw error;
    }
  }

  /**
   * 设置模型交互
   */
  setupInteractions() {
    if (!this.model) return;

    this.model.interactive = true;
    this.model.buttonMode = true;

    // 点击事件
    this.model.on('pointertap', (event) => {
      const localPos = event.data.getLocalPosition(this.model);
      this.onTap(localPos);
    });

    // 悬停事件
    this.model.on('pointerover', () => {
      this.onHover(true);
    });

    this.model.on('pointerout', () => {
      this.onHover(false);
    });
  }

  /**
   * 设置眼睛跟踪
   * @param {HTMLElement} element - 要跟踪鼠标的元素
   */
  setupEyeTracking(element) {
    element.addEventListener('pointermove', (event) => {
      if (this.model && this.model.internalModel) {
        const rect = element.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
        
        // 设置眼睛跟踪
        if (this.model.internalModel.coreModel) {
          const coreModel = this.model.internalModel.coreModel;
          // 眼睛X方向
          if (coreModel.setParameterValueById) {
            coreModel.setParameterValueById('ParamEyeBallX', x * 0.5);
            coreModel.setParameterValueById('ParamEyeBallY', -y * 0.5);
          }
        }
      }
    });
  }

  /**
   * 点击处理
   */
  onTap(localPos) {
    if (this.isInteracting) return;
    this.isInteracting = true;

    // 根据点击位置触发不同动作
    let motion = 'tap_body';
    
    // 头部点击
    if (localPos.y < -0.3) {
      motion = 'flick_head';
    }
    // 身体点击
    else if (localPos.y >= -0.3 && localPos.y < 0.2) {
      motion = 'tap_body';
    }
    // 下半身点击
    else {
      motion = 'shake';
    }

    this.playMotion(motion);

    setTimeout(() => {
      this.isInteracting = false;
    }, 1000);
  }

  /**
   * 悬停处理
   */
  onHover(isHovering) {
    // 可以添加悬停特效
  }

  /**
   * 播放动作
   * @param {string} motionName - 动作名称
   * @param {number} priority - 优先级 (1-5)
   */
  async playMotion(motionName, priority = 3) {
    if (!this.model) {
      console.warn('[Live2DRenderer] 无法播放动作: 模型未加载');
      return;
    }

    console.log('[Live2DRenderer] 播放动作:', motionName, '(优先级:', priority + ')');
    try {
      await this.model.motion(motionName, undefined, priority);
      console.log('[Live2DRenderer] 动作播放成功:', motionName);
      if (this.onMotionPlay) {
        this.onMotionPlay(motionName);
      }
    } catch (e) {
      console.warn('[Live2DRenderer] 动作播放失败:', motionName, e);
      // 动作可能不存在，尝试播放其他动作
      const fallbacks = ['Idle', 'idle', 'TapBody', 'tap_body'];
      console.log('[Live2DRenderer] 尝试备用动作:', fallbacks);
      for (const fb of fallbacks) {
        try {
          await this.model.motion(fb);
          console.log('[Live2DRenderer] 备用动作播放成功:', fb);
          break;
        } catch (e2) {
          continue;
        }
      }
    }
  }

  /**
   * 播放表情
   * @param {string} expressionName - 表情名称
   */
  async playExpression(expressionName) {
    if (!this.model) return;

    try {
      await this.model.expression(expressionName);
    } catch (e) {
      console.log(`Expression "${expressionName}" not found`);
    }
  }

  /**
   * 根据文本情感播放对应动作和表情
   * @param {string} text - 文本内容
   */
  async playMotionByText(text) {
    // 情感关键词匹配
    const emotionKeywords = {
      happy: ['开心', '高兴', '快乐', '好', '棒', '太好了', '哈哈', '谢谢', '喜欢', '爱', '好的', '没问题'],
      sad: ['难过', '伤心', '不开心', '不好', '糟糕', '抱歉', '对不起', '遗憾'],
      surprise: ['哇', '啊', '真的', '什么', '天哪', '没想到', '竟然'],
      thinking: ['思考', '想想', '考虑', '嗯', '让我想想', '问题是', '分析'],
      angry: ['生气', '愤怒', '讨厌', '烦', '可恶', '不爽'],
      wave: ['你好', '嗨', 'hi', 'hello', '再见', '拜拜']
    };

    // 动作映射
    const motionMap = {
      happy: ['flick_head', 'pinch_in'],
      sad: ['shake'],
      surprise: ['shake'],
      thinking: [],
      angry: ['shake'],
      wave: ['flick_head']
    };

    // 表情映射
    const expressionMap = {
      happy: 'happy',
      sad: 'sad',
      surprise: 'surprise',
      thinking: 'thinking'
    };

    // 检测情感
    const lowerText = text.toLowerCase();
    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          // 播放对应动作
          const motions = motionMap[emotion];
          if (motions && motions.length > 0) {
            const randomMotion = motions[Math.floor(Math.random() * motions.length)];
            await this.playMotion(randomMotion, 4);
          }
          // 播放表情
          if (expressionMap[emotion]) {
            await this.playExpression(expressionMap[emotion]);
          }
          return;
        }
      }
    }
  }

  /**
   * 启动待机动作循环
   */
  startIdleMotion() {
    if (this.motionTimer) {
      clearInterval(this.motionTimer);
    }

    this.motionTimer = setInterval(() => {
      if (!this.isInteracting && this.model) {
        const random = Math.random();
        if (random < 0.08) {
          // 8% 几率播放非待机动作
          const motions = ['tap_body', 'flick_head', 'shake'];
          const randomMotion = motions[Math.floor(Math.random() * motions.length)];
          this.playMotion(randomMotion, 2);
        }
      }
    }, 8000);
  }

  /**
   * 设置定时动作
   * @param {Array} schedules - 定时配置数组
   */
  setScheduledMotions(schedules) {
    if (!schedules || !schedules.length) return;

    const checkSchedule = () => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      for (const schedule of schedules) {
        if (schedule.time === currentTime && !this.isInteracting) {
          if (schedule.motion) {
            this.playMotion(schedule.motion, 5);
          }
          if (schedule.expression) {
            this.playExpression(schedule.expression);
          }
        }
      }
    };

    // 每分钟检查一次
    setInterval(checkSchedule, 60000);
    checkSchedule(); // 立即检查一次
  }

  /**
   * 获取模型可用的动作列表
   */
  getAvailableMotions() {
    if (!this.model || !this.model.internalModel) return [];
    
    try {
      const settings = this.model.internalModel.settings;
      if (settings && settings.motions) {
        return Object.keys(settings.motions);
      }
    } catch (e) {
      console.log('Could not get motion list');
    }
    return [];
  }

  /**
   * 获取模型可用的表情列表
   */
  getAvailableExpressions() {
    if (!this.model || !this.model.internalModel) return [];
    
    try {
      const settings = this.model.internalModel.settings;
      if (settings && settings.expressions) {
        return settings.expressions.map(e => e.Name || e.name);
      }
    } catch (e) {
      console.log('Could not get expression list');
    }
    return [];
  }

  /**
   * 调整模型大小
   */
  setScale(scale) {
    if (this.model) {
      this.model.scale.set(scale);
    }
  }

  /**
   * 调整模型位置偏移
   */
  setPositionOffset(x, y) {
    if (this.model) {
      this.model.x = this.app.screen.width / 2 + x;
      this.model.y = this.app.screen.height / 2 + y;
    }
  }

  /**
   * 销毁渲染器
   */
  destroy() {
    console.log('[Live2DRenderer] 销毁 Live2D 渲染器');
    if (this.motionTimer) {
      clearInterval(this.motionTimer);
      this.motionTimer = null;
    }
    if (this.model) {
      try {
        this.model.destroy();
        this.model = null;
      } catch (e) {
        console.warn('[Live2DRenderer] 销毁模型时出错:', e);
      }
    }
    if (this.app) {
      try {
        this.app.destroy(true);
        this.app = null;
      } catch (e) {
        console.warn('[Live2DRenderer] 销毁 PIXI 应用时出错:', e);
      }
    }
    console.log('[Live2DRenderer] Live2D 渲染器已销毁');
  }
}

// 导出到全局
window.Live2DRenderer = Live2DRenderer;