/**
 * 静态图片智能动画模块
 * 让静态图片通过CSS动画和简单效果动起来
 */

class SmartImageAnimator {
  constructor(container) {
    this.container = container;
    this.currentImage = null;
    this.animationTimer = null;
    this.currentAnimation = 'idle';
  }

  /**
   * 加载图片
   * @param {string} imagePath - 图片路径
   * @param {Object} options - 配置选项
   */
  loadImage(imagePath, options = {}) {
    console.log('[SmartImageAnimator] 开始加载图片:', imagePath);
    const defaultOptions = {
      width: 160,
      height: 160,
      scale: 1,
      offsetX: 0,
      offsetY: 0
    };

    this.options = { ...defaultOptions, ...options };
    console.log('[SmartImageAnimator] 配置选项:', this.options);

    // 创建图片元素
    this.container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'smart-image-wrapper';
    wrapper.style.cssText = `
      width: ${this.options.width}px;
      height: ${this.options.height}px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    this.currentImage = document.createElement('img');
    this.currentImage.src = imagePath;
    this.currentImage.className = 'smart-image';
    this.currentImage.style.cssText = `
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      transform-origin: center bottom;
      filter: drop-shadow(0 2px 8px rgba(0,0,0,0.2));
    `;
    this.currentImage.onload = () => {
      console.log('[SmartImageAnimator] 图片加载完成');
    };
    this.currentImage.onerror = (e) => {
      console.error('[SmartImageAnimator] 图片加载失败:', e);
    };

    wrapper.appendChild(this.currentImage);
    this.container.appendChild(wrapper);
    console.log('[SmartImageAnimator] 图片元素已添加到容器');

    // 启动智能动画
    this.startSmartAnimation();

    console.log('[SmartImageAnimator] ✓ 图片加载完成');
    return true;
  }

  /**
   * 启动智能动画
   */
  startSmartAnimation() {
    // 清理旧定时器
    if (this.animationTimer) {
      clearInterval(this.animationTimer);
    }
    
    // 默认呼吸动画
    this.playAnimation('breath');
    
    // 定时播放随机动作
    this.animationTimer = setInterval(() => {
      const random = Math.random();
      
      if (random < 0.15) {
        // 15% 播放跳跃
        this.playAnimation('jump');
      } else if (random < 0.25) {
        // 10% 播放摇摆
        this.playAnimation('wobble');
      } else if (random < 0.35) {
        // 10% 播放旋转
        this.playAnimation('spin');
      } else if (random < 0.45) {
        // 10% 播放眨眼效果
        this.playAnimation('blink');
      }
    }, 3000);
  }

  /**
   * 播放动画
   * @param {string} animationName - 动画名称
   */
  playAnimation(animationName) {
    if (!this.currentImage) {
      console.warn('[SmartImageAnimator] 无法播放动画: 图片未加载');
      return;
    }

    console.log('[SmartImageAnimator] 播放动画:', animationName);
    // 先移除旧动画类
    this.currentImage.classList.remove(
      'anim-breath', 'anim-jump', 'anim-wobble',
      'anim-spin', 'anim-blink', 'anim-wave',
      'anim-dance', 'anim-shake', 'anim-happy'
    );

    // 强制重绘
    void this.currentImage.offsetWidth;

    // 添加新动画类
    this.currentImage.classList.add(`anim-${animationName}`);
    this.currentAnimation = animationName;
    console.log('[SmartImageAnimator] 动画已应用:', animationName);
  }

  /**
   * 根据文本情感播放动画
   * @param {string} text - 文本内容
   */
  playAnimationByText(text) {
    const lowerText = text.toLowerCase();
    
    // 情感关键词映射
    const emotionMap = {
      jump: ['开心', '高兴', '好', '棒', '太好了', '哈哈', '谢谢', '喜欢'],
      dance: ['跳舞', '跳舞', 'dance', '庆祝'],
      wave: ['你好', '嗨', 'hi', 'hello', '再见', '拜拜'],
      shake: ['生气', '愤怒', '讨厌', '不', '不行'],
      spin: ['转', '旋转', '转圈', '开心'],
      wobble: ['疑问', '什么', '为什么', '怎么'],
      happy: ['开心', '快乐', '幸福', '好开心']
    };
    
    for (const [anim, keywords] of Object.entries(emotionMap)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          this.playAnimation(anim);
          return;
        }
      }
    }
    
    // 默认播放happy
    this.playAnimation('happy');
  }

  /**
   * 停止动画
   */
  stopAnimation() {
    if (this.animationTimer) {
      clearInterval(this.animationTimer);
    }
    if (this.currentImage) {
      this.currentImage.classList.remove(
        'anim-breath', 'anim-jump', 'anim-wobble', 
        'anim-spin', 'anim-blink', 'anim-wave',
        'anim-dance', 'anim-shake', 'anim-happy'
      );
    }
  }

  /**
   * 设置缩放
   */
  setScale(scale) {
    if (this.currentImage) {
      this.currentImage.style.transform = `scale(${scale})`;
    }
  }

  /**
   * 销毁
   */
  destroy() {
    console.log('[SmartImageAnimator] 销毁图片动画器');
    this.stopAnimation();
    if (this.container) {
      this.container.innerHTML = '';
    }
    console.log('[SmartImageAnimator] 图片动画器已销毁');
  }
}

// 动画样式（注入到页面）
const animationStyles = `
/* 智能动画样式 */
.smart-image-wrapper {
  perspective: 1000px;
}

/* 呼吸动画 */
.smart-image.anim-breath {
  animation: breath 3s ease-in-out infinite;
}

@keyframes breath {
  0%, 100% { transform: scale(1) translateY(0); }
  50% { transform: scale(1.02) translateY(-2px); }
}

/* 跳跃动画 */
.smart-image.anim-jump {
  animation: jump 0.6s ease-in-out;
}

@keyframes jump {
  0%, 100% { transform: scale(1) translateY(0); }
  30% { transform: scale(1.1, 0.9) translateY(0); }
  50% { transform: scale(0.95, 1.1) translateY(-25px); }
  70% { transform: scale(1.05, 0.95) translateY(0); }
}

/* 摇摆动画 */
.smart-image.anim-wobble {
  animation: wobble 0.8s ease-in-out;
}

@keyframes wobble {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-8deg); }
  75% { transform: rotate(8deg); }
}

/* 旋转动画 */
.smart-image.anim-spin {
  animation: spin 0.8s ease-in-out;
}

@keyframes spin {
  0% { transform: rotate(0deg) scale(1); }
  50% { transform: rotate(180deg) scale(0.9); }
  100% { transform: rotate(360deg) scale(1); }
}

/* 眨眼效果（缩放+透明） */
.smart-image.anim-blink {
  animation: blink 0.3s ease-in-out;
}

@keyframes blink {
  0%, 100% { transform: scaleY(1); opacity: 1; }
  50% { transform: scaleY(0.1); opacity: 0.8; }
}

/* 挥手动画 */
.smart-image.anim-wave {
  animation: wave 0.6s ease-in-out 3;
}

@keyframes wave {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-15deg); }
  75% { transform: rotate(15deg); }
}

/* 跳舞动画 */
.smart-image.anim-dance {
  animation: dance 0.4s ease-in-out infinite;
}

@keyframes dance {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-10px) rotate(-5deg); }
  75% { transform: translateY(-5px) rotate(5deg); }
}

/* 抖动动画 */
.smart-image.anim-shake {
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
}

/* 开心动画 */
.smart-image.anim-happy {
  animation: happy 0.5s ease-in-out;
}

@keyframes happy {
  0%, 100% { transform: scale(1) rotate(0deg); }
  25% { transform: scale(1.1) rotate(-5deg); }
  50% { transform: scale(1.15) rotate(5deg); }
  75% { transform: scale(1.1) rotate(-3deg); }
}

/* 悬停效果 */
.smart-image:hover {
  filter: drop-shadow(0 4px 12px rgba(102, 126, 234, 0.4));
}
`;

// 将样式注入到页面
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = animationStyles;
  document.head.appendChild(styleElement);
}

// 导出到全局
window.SmartImageAnimator = SmartImageAnimator;
