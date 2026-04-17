/**
 * GLTF/GLB 3D模型渲染模块
 * 依赖: three.min.js + GLTFLoader.bundle.js (官方 GLTFLoader, rollup 打包)
 */

(function() {
  'use strict';

  class GLTFRenderer {
    constructor(container) {
      this.container = container;
      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.model = null;
      this.mixer = null;
      this._debugMode = false; // 调试模式
      this._lockResize = false; // 拖动时锁定
      this._lastMinY = undefined; // 记录上次的模型底部位置
      this.animations = [];
      this.proceduralAnims = {};  // 程序化动画：动作名 -> { duration, startTime }
      this.currentAction = null;
      this.clock = null;
      this.autoAnimTimer = null;
      this.animationId = null;
      this.onModelLoaded = null;
      this.baseScale = 1;    // 自动适配后的基础缩放
      this.userScale = 1;    // 用户设置的缩放乘数

      // 骨骼缓存
      this.bones = {};       // 骨骼名 -> Bone 对象
      this.boneNames = [];   // 所有骨骼名列表
      this.hasSkeleton = false;
    }

    async init() {
      if (!window.THREE) {
        throw new Error('THREE.js not loaded');
      }

      const THREE = window.THREE;
      const W = this.container.clientWidth  || 160;
      const H = this.container.clientHeight || 160;

      // ---- Scene ----
      this.clock  = new THREE.Clock();
      this.scene  = new THREE.Scene();

      // ---- Camera ----
      this.camera = new THREE.PerspectiveCamera(60, W / H, 0.01, 1000);
      
      // 计算相机位置，让 y=0 平面对齐窗口底部
      const fovRad = (60 * Math.PI) / 180;
      const dist = 10;  // 相机距离
      const visibleHeight = 2 * dist * Math.tan(fovRad / 2);
      
      // 相机向上偏移，使 y=0 平面位于窗口底部
      this.camera.position.set(0, visibleHeight / 2, dist);
      this.camera.lookAt(0, visibleHeight / 2, 0);
      
      console.log('[GLTFRenderer] 相机初始化: 可见高度=', visibleHeight.toFixed(4), '相机位置 y=', (visibleHeight / 2).toFixed(4));

      // ---- Renderer ----
      this.renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: false
      });
      this.renderer.setSize(W, H);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setClearColor(0x000000, 0);

      if (THREE.SRGBColorSpace !== undefined) {
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      } else if (THREE.sRGBEncoding !== undefined) {
        this.renderer.outputEncoding = THREE.sRGBEncoding;
      }

      // ---- Mount canvas ----
      this.container.innerHTML = '';
      this.container.appendChild(this.renderer.domElement);
      this.renderer.domElement.style.cssText =
        'display:block; width:100%; height:100%; border-radius:0; pointer-events:none;';

      // ---- ResizeObserver: 自动响应容器大小变化 ----
      if (this._resizeObserver) this._resizeObserver.disconnect();
      this._lockResize = false; // 拖动时锁定
      this._resizeObserver = new ResizeObserver((entries) => {
        if (this._lockResize) {
          console.log('[GLTFRenderer] ResizeObserver 被锁定，忽略调整');
          return;
        }
        const w = this.container.clientWidth  || 160;
        const h = this.container.clientHeight || 160;
        console.log('[GLTFRenderer] ResizeObserver 触发: 容器大小', w, 'x', h);
        if (this.renderer) {
          this.renderer.setSize(w, h);
          console.log('[GLTFRenderer] 渲染器大小已更新');
        }
        if (this.camera) {
          this.camera.aspect = w / h;
          this.camera.updateProjectionMatrix();
          
          // 更新相机 y 位置，保持 y=0 平面对齐窗口底部
          const fovRad = (60 * Math.PI) / 180;
          const dist = 10;
          const visibleHeight = 2 * dist * Math.tan(fovRad / 2);
          this.camera.position.y = visibleHeight / 2;
          this.camera.lookAt(0, visibleHeight / 2, 0);
          
          console.log('[GLTFRenderer] 相机投影矩阵已更新，y 位置:', (visibleHeight / 2).toFixed(4));
        }
      });
      this._resizeObserver.observe(this.container);

      // ---- Lights ----
      const ambient = new THREE.AmbientLight(0xffffff, 1.2);
      this.scene.add(ambient);

      const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
      dirLight.position.set(1, 2, 3);
      this.scene.add(dirLight);

      const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
      fillLight.position.set(-1, -1, -1);
      this.scene.add(fillLight);

      // ---- Start render loop ----
      this._animate();

      return true;
    }

    _animate() {
      this.animationId = requestAnimationFrame(() => this._animate());
      if (!this.renderer || !this.scene || !this.camera || !this.clock) return;

      const delta = this.clock.getDelta();

      if (this.mixer) {
        this.mixer.update(delta);
      }

      // 更新程序化动画
      this._updateProceduralAnimations(delta);

      // Gentle auto-rotation（没有程序化动画时才自转）
      if (this.model && Object.keys(this.proceduralAnims).length === 0) {
        this.model.rotation.y += delta * 0.5;
      }

      // 调试：检查动画播放时模型边界是否变化（仅在开发模式）
      if (this.model && this._debugMode) {
        const box = new THREE.Box3().setFromObject(this.model);
        const minY = box.min.y;
        if (this._lastMinY !== undefined && Math.abs(minY - this._lastMinY) > 0.01) {
          console.log('[GLTFRenderer] ⚠️ 模型边界变化:', this._lastMinY.toFixed(4), '->', minY.toFixed(4));
        }
        this._lastMinY = minY;
      }

      this.renderer.render(this.scene, this.camera);
    }

    /**
     * 启用/禁用调试模式
     */
    setDebugMode(enabled) {
      this._debugMode = enabled;
      console.log('[GLTFRenderer] 调试模式:', enabled ? '启用' : '禁用');
    }

    /**
     * 扫描模型骨架
     */
    _scanSkeleton() {
      this.bones = {};
      this.boneNames = [];
      this.hasSkeleton = false;

      if (!this.model) return;

      const THREE = window.THREE;
      this.model.traverse((child) => {
        if (child.isBone) {
          this.hasSkeleton = true;
          this.bones[child.name] = child;
          this.boneNames.push(child.name);
        }
      });

      if (this.hasSkeleton) {
        console.log('╔══════════════════════════════════════════════╗');
        console.log('║          🦴 骨架信息 (Skeleton)             ║');
        console.log('╠══════════════════════════════════════════════╣');
        console.log('║ 骨骼总数:', this.boneNames.length);
        console.log('╠══════════════════════════════════════════════╣');
        this.boneNames.forEach((name, i) => {
          const bone = this.bones[name];
          console.log('║  [' + String(i).padStart(2, '0') + '] ' + name);
        });
        console.log('╠══════════════════════════════════════════════╣');
        console.log('║ 关键骨骼识别:');

        const keyBones = this._findKeyBones();
        for (const [role, bone] of Object.entries(keyBones)) {
          console.log('║   ' + role + ' → ' + (bone || '❌ 未找到'));
        }
        console.log('╠══════════════════════════════════════════════╣');

        if (this.animations.length > 0) {
          console.log('║ 内置动画 (' + this.animations.length + ' 个):');
          this.animations.forEach((clip, i) => {
            console.log('║   [' + i + '] ' + clip.name + ' (' + clip.duration.toFixed(2) + 's)');
          });
        } else {
          console.log('║ ⚠️ 模型无内置动画，将使用程序化动画');
        }
        console.log('╚══════════════════════════════════════════════╝');
      } else {
        console.log('⚠️ 该模型无骨架(Skeleton)，无法做骨骼动画。可用整体变换动画。');
      }
    }

    /**
     * 将 Three.js 轨道类型转成可读中文标签
     */
    _trackTypeLabel(className) {
      const map = {
        'QuaternionKeyframeTrack':    '🦴 骨骼旋转',
        'VectorKeyframeTrack':         '📐 位移/缩放',
        'NumberKeyframeTrack':         '🎯 变形目标/权重',
        'ColorKeyframeTrack':          '🎨 颜色',
        'BooleanKeyframeTrack':        '🔘 可见性',
      };
      return map[className] || className;
    }

    /**
     * 识别关键骨骼（模糊匹配）
     */
    _findKeyBones() {
      const name = (n) => n ? n.toLowerCase() : '';

      const find = (patterns) => {
        for (const p of patterns) {
          for (const boneName of this.boneNames) {
            if (name(boneName).includes(p)) return boneName;
          }
        }
        return null;
      };

      return {
        '头部 Head':     find(['head', 'neck']),
        '脊柱 Spine':    find(['spine', 'spine1', 'spine01', 'chest', 'torso']),
        '左臂 L.Arm':    find(['upperarm_l', 'arm_l', 'armleft', 'leftarm', 'shoulder_l', 'shoulderleft']),
        '右臂 R.Arm':    find(['upperarm_r', 'arm_r', 'armright', 'rightarm', 'shoulder_r', 'shoulderright']),
        '左前臂 L.Fore': find(['lowerarm_l', 'forearm_l', 'forearmleft', 'leftforearm', 'elbow_l']),
        '右前臂 R.Fore': find(['lowerarm_r', 'forearm_r', 'forearmright', 'rightforearm', 'elbow_r']),
        '左手 L.Hand':   find(['hand_l', 'handleft', 'lefthand', 'wrist_l']),
        '右手 R.Hand':   find(['hand_r', 'handright', 'righthand', 'wrist_r']),
        '左腿 L.Leg':    find(['upperleg_l', 'thigh_l', 'leg_l', 'leftleg', 'hip_l']),
        '右腿 R.Leg':    find(['upperleg_r', 'thigh_r', 'leg_r', 'rightleg', 'hip_r']),
        '左小腿 L.Shin': find(['lowerleg_l', 'shin_l', 'calf_l', 'knee_l']),
        '右小腿 R.Shin': find(['lowerleg_r', 'shin_r', 'calf_r', 'knee_r']),
        '左脚 L.Foot':   find(['foot_l', 'leftfoot', 'ankle_l']),
        '右脚 R.Foot':   find(['foot_r', 'rightfoot', 'ankle_r']),
        '根骨骼 Root':   find(['root', 'hips', 'pelvis', 'body']),
      };
    }

    /**
     * 获取可用的互动动作列表
     */
    getAvailableActions() {
      const actions = [];

      // 内置动画
      if (this.animations.length > 0) {
        this.animations.forEach((clip, i) => {
          actions.push({ name: clip.name, type: 'builtin', index: i });
        });
      }

      // 程序化动画（根据骨骼判断可用性）
      if (this.hasSkeleton) {
        const keyBones = this._findKeyBones();
        const hasArms = keyBones['左臂 L.Arm'] || keyBones['右臂 R.Arm'];
        const hasLegs = keyBones['左腿 L.Leg'] || keyBones['右腿 R.Leg'];
        const hasHead = !!keyBones['头部 Head'];
        const hasSpine = !!keyBones['脊柱 Spine'];

        if (hasArms) {
          actions.push({ name: '挥手 Wave', type: 'procedural' });
          actions.push({ name: '鼓掌 Clap', type: 'procedural' });
        }
        if (hasSpine) {
          actions.push({ name: '跳舞 Dance', type: 'procedural' });
        }
        if (hasHead) {
          actions.push({ name: '点头 Nod', type: 'procedural' });
          actions.push({ name: '摇头 ShakeHead', type: 'procedural' });
        }
        if (hasArms && hasLegs) {
          actions.push({ name: '蹦跳 Jump', type: 'procedural' });
        }
        if (hasSpine && hasArms) {
          actions.push({ name: '旋转 Spin', type: 'procedural' });
        }
        actions.push({ name: '摇摆 Wiggle', type: 'procedural' });
      } else {
        // 无骨架：整体变换动画
        actions.push({ name: '蹦跳 Jump', type: 'procedural' });
        actions.push({ name: '旋转 Spin', type: 'procedural' });
        actions.push({ name: '摇摆 Wiggle', type: 'procedural' });
      }

      return actions;
    }

    async loadModel(modelPath, displaySize = 0.2) {
      const THREE = window.THREE;
      if (!THREE || !THREE.GLTFLoader) {
        throw new Error('THREE.GLTFLoader not available');
      }

      // ---- Clear old model ----
      if (this.model) {
        this.scene.remove(this.model);
        this.model = null;
      }
      if (this.mixer) {
        this.mixer.stopAllAction();
        this.mixer = null;
      }
      this.animations = [];
      this.currentAction = null;
      this.proceduralAnims = {};
      this.bones = {};
      this.boneNames = [];
      this.hasSkeleton = false;
      this.userScale = 1;

      // ---- Resolve path ----
      let url = modelPath;
      if (url && !url.startsWith('http') && !url.startsWith('blob:') && !url.startsWith('file:')) {
        url = 'file:///' + url.replace(/\\/g, '/');
      }
      console.log('[GLTFRenderer] Loading model:', url);

      // ---- Load ----
      const loader = new THREE.GLTFLoader();
      let gltf;
      try {
        gltf = await new Promise((resolve, reject) => {
          loader.load(
            url,
            resolve,
            (xhr) => {
              if (xhr.lengthComputable) {
                const pct = Math.round(xhr.loaded / xhr.total * 100);
                console.log(`[GLTFRenderer] Loading: ${pct}%`);
              }
            },
            (err) => {
              console.error('[GLTFRenderer] Load error:', err);
              reject(err);
            }
          );
        });
      } catch (e) {
        throw new Error('Failed to load GLTF model: ' + (e.message || e));
      }

      this.model = gltf.scene;

      // ---- Auto-fit model to view ----
      const box    = new THREE.Box3().setFromObject(this.model);
      const size   = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      const maxDim = Math.max(size.x, size.y, size.z);
      console.log('[GLTFRenderer] Model bounds - size:', size.x.toFixed(3), size.y.toFixed(3), size.z.toFixed(3), 'maxDim:', maxDim.toFixed(3));

      if (maxDim > 0) {
        const fovRad = (60 * Math.PI) / 180;
        const dist = 10;  // 与相机 z=10 对应
        const visibleHeight = 2 * dist * Math.tan(fovRad / 2);
        const TARGET_VIS = displaySize;  // 模型占窗口高度的比例（可配置）
        this.baseScale = visibleHeight * TARGET_VIS / maxDim;
        const finalScale = this.baseScale * this.userScale;
        this.model.scale.setScalar(finalScale);

        // 计算"自然窗口尺寸"：模型在 scale=1 时，窗口应有多大才能完整显示模型
        // 基于 TARGET_VIS 调整：原 4 * 0.5 ≈ 2，调整为 4 * 0.85 ≈ 3.4
        const dpr = window.devicePixelRatio || 1;
        this.naturalWindowSize = Math.round(maxDim * 3.4 * dpr);
        console.log('[GLTFRenderer] Applied scale:', finalScale.toFixed(4), '(base:', this.baseScale.toFixed(4), 'user:', this.userScale.toFixed(4) + ')');
        console.log('[GLTFRenderer] naturalWindowSize:', this.naturalWindowSize, 'px (DPR:', dpr, ')');

        // 模型底部对齐窗口底部
        // 由于相机向上偏移了 visibleHeight/2，所以 Three.js 的 y=0 平面对应窗口底部
        // 窗口底部在 Three.js 坐标系中就是 y = 0
        const windowBottom = 0;  // y=0 就是窗口底部
        
        // 模型底部在世界坐标系 = position.y + box.min.y * finalScale
        // 需要让它等于 windowBottom (也就是 0)
        const positionY = windowBottom - box.min.y * finalScale;

        this.model.position.set(
          -center.x * finalScale,
          positionY,
          -center.z * finalScale
        );
        
        // 验证底部对齐
        const actualModelBottom = positionY + box.min.y * finalScale;
        console.log('[GLTFRenderer] ===== 模型底部对齐计算 =====');
        console.log('[GLTFRenderer] 可见高度 visibleHeight:', visibleHeight.toFixed(4));
        console.log('[GLTFRenderer] 窗口底部 windowBottom:', windowBottom.toFixed(4), '(y=0 对应窗口底部)');
        console.log('[GLTFRenderer] 模型边界 box.min.y:', box.min.y.toFixed(4));
        console.log('[GLTFRenderer] 最终缩放 finalScale:', finalScale.toFixed(4));
        console.log('[GLTFRenderer] 模型位置 position.y:', positionY.toFixed(4));
        console.log('[GLTFRenderer] 实际模型底部:', actualModelBottom.toFixed(4));
        console.log('[GLTFRenderer] 对齐误差:', (actualModelBottom - windowBottom).toFixed(6));
        console.log('[GLTFRenderer] ==============================');
      }

      this.scene.add(this.model);
      console.log('[GLTFRenderer] Model added to scene. Children:', this.model.children.length);
      
      // 加载后立即验证对齐（此时还没有动画影响）
      this._verifyAlignment();

      // 调试：添加地面网格辅助线（临时）
      if (this._debugMode) {
        const gridHelper = new THREE.GridHelper(20, 20, 0xff0000, 0x444444);
        gridHelper.position.y = 0;  // y=0 平面
        this.scene.add(gridHelper);
        console.log('[GLTFRenderer] 调试模式：已添加地面网格，y=0 平面可视化');
        
        // 添加坐标轴辅助
        const axesHelper = new THREE.AxesHelper(5);
        axesHelper.position.y = 0;
        this.scene.add(axesHelper);
        console.log('[GLTFRenderer] 调试模式：已添加坐标轴辅助线');
      }

      // ---- Scan skeleton ----
      this._scanSkeleton();

      // ---- Animations (built-in) ----
      if (gltf.animations && gltf.animations.length > 0) {
        this.animations = gltf.animations;
        this.mixer = new THREE.AnimationMixer(this.model);

        // 详细分析每个动画的轨道信息
        console.log('╔══════════════════════════════════════════════╗');
        console.log('║          🎬 内置动画分析                      ║');
        console.log('╠══════════════════════════════════════════════╣');
        console.log('║ 动画总数:', this.animations.length);
        console.log('╠══════════════════════════════════════════════╣');

        this.animations.forEach((clip, i) => {
          // 分析轨道类型
          const trackTypes = {};
          let targetNames = new Set();

          clip.tracks.forEach(track => {
            const trackType = track.constructor.name;
            trackTypes[trackType] = (trackTypes[trackType] || 0) + 1;
            // 提取目标名称（如骨骼名或 mesh 名）
            const parts = track.name.split('.');
            if (parts.length > 0) {
              targetNames.add(parts[0]);
            }
          });

          console.log('║ [' + i + '] ' + (clip.name || '(unnamed)') + ' (' + clip.duration.toFixed(2) + 's)');
          const typeEntries = Object.entries(trackTypes);
          typeEntries.forEach(([type, count]) => {
            const label = this._trackTypeLabel(type);
            console.log('║     ' + label + ': ' + count + ' 条轨道');
          });
          console.log('║     目标: ' + [...targetNames].slice(0, 5).join(', ') + (targetNames.size > 5 ? '...' : ''));
          console.log('╟──────────────────────────────────────────────');
        });
        console.log('╚══════════════════════════════════════════════╝');

        // 暂不自动播放动画，避免动画改变模型边界导致底部对齐失效
        // 用户点击模型或通过互动触发时才播放
        console.log('ℹ️ 模型已加载，点击模型或调用 playAnimation() 触发动画');
      } else {
        console.log('ℹ️ 该模型没有内置动画 (gltf.animations 为空)');
        console.log('   可能原因：模型仅包含静态网格，或动画存储在变形目标(MorphTargets)中');
      }

      // 输出可用动作列表
      const availableActions = this.getAvailableActions();
      console.log('🎮 可用互动动作 (' + availableActions.length + '):');
      availableActions.forEach(a => {
        console.log('   • ' + a.name + ' [' + a.type + ']');
      });

      if (typeof this.onModelLoaded === 'function') {
        this.onModelLoaded(this.model);
      }

      return true;
    }

    /**
     * 验证并修正模型底部对齐
     */
    _verifyAlignment() {
      if (!this.model) return;
      
      const THREE = window.THREE;
      const box = new THREE.Box3().setFromObject(this.model);
      const currentBottom = box.min.y;
      
      if (Math.abs(currentBottom) > 0.001) {
        console.log('[GLTFRenderer] ⚠️ 检测到对齐偏差，正在修正...');
        console.log('[GLTFRenderer] 当前模型底部:', currentBottom.toFixed(4), '期望: 0');
        
        // 修正位置：向下移动当前底部距离
        this.model.position.y -= currentBottom;
        
        // 再次验证
        const newBox = new THREE.Box3().setFromObject(this.model);
        console.log('[GLTFRenderer] 修正后模型底部:', newBox.min.y.toFixed(4));
      } else {
        console.log('[GLTFRenderer] ✓ 模型底部已正确对齐到 y=0');
      }
    }
    
    /**
     * 动画结束后重新对齐到地面（静默修正）
     */
    _realignToGround() {
      if (!this.model) return;
      
      const THREE = window.THREE;
      const box = new THREE.Box3().setFromObject(this.model);
      const currentBottom = box.min.y;
      
      if (Math.abs(currentBottom) > 0.01) {
        // 静默修正，只在偏差较大时打印日志
        this.model.position.y -= currentBottom;
        console.log('[GLTFRenderer] 自动对齐修正: y', currentBottom.toFixed(4), '-> 0');
      }
    }

    // ==================== 内置动画 ====================

    /**
     * 获取模型内置动画的详细信息列表（供外部面板/菜单使用）
     * 返回: [{ name, duration, trackTypes, targetCount, index }]
     */
    getAnimationList() {
      if (!this.animations || this.animations.length === 0) return [];

      return this.animations.map((clip, i) => {
        const trackTypes = {};
        const targetNames = new Set();

        clip.tracks.forEach(track => {
          const trackType = track.constructor.name;
          trackTypes[trackType] = (trackTypes[trackType] || 0) + 1;
          const parts = track.name.split('.');
          if (parts.length > 0) targetNames.add(parts[0]);
        });

        const typeLabels = Object.entries(trackTypes).map(([type, count]) => {
          return this._trackTypeLabel(type) + ':' + count;
        });

        return {
          name: clip.name || ('动画 ' + (i + 1)),
          duration: clip.duration,
          trackTypes: typeLabels,
          targets: [...targetNames],
          index: i
        };
      });
    }

    _playAnimation(index) {
      if (!this.mixer || !this.animations.length) return;
      // 立即打断当前动画（fadeOut 0.05s，近似立即切换）
      if (this.currentAction) {
        this.currentAction.fadeOut(0.05);
      }
      const clip   = this.animations[index % this.animations.length];
      const action = this.mixer.clipAction(clip);
      action.reset().fadeIn(0.1).play();
      this.currentAction = action;
    }

    playAnimation(index) {
      this._playAnimation(index);
    }

    playAnimationByText(text) {
      // 先尝试匹配程序化动画
      const proceduralName = this._matchProceduralAction(text);
      if (proceduralName) {
        this.playProceduralAction(proceduralName);
        return;
      }
      // 回退到内置动画
      if (this.animations.length > 1) {
        this._playAnimation(Math.floor(Math.random() * this.animations.length));
      }
    }

    startAutoAnimation() {
      this._stopAutoAnimation();
      this.autoAnimTimer = setInterval(() => {
        // 如果有程序化动画正在播放，跳过本次
        if (Object.keys(this.proceduralAnims).length > 0) return;

        const actions = this.getAvailableActions();
        if (actions.length > 0) {
          const randomAction = actions[Math.floor(Math.random() * actions.length)];
          if (randomAction.type === 'procedural') {
            this.playProceduralAction(randomAction.name);
          } else {
            this._playAnimation(randomAction.index);
          }
        }
      }, 12000); // 12秒随机触发一次，避免过于频繁
    }

    _stopAutoAnimation() {
      if (this.autoAnimTimer) {
        clearInterval(this.autoAnimTimer);
        this.autoAnimTimer = null;
      }
    }

    // ==================== 程序化互动动画 ====================

    /**
     * 文本匹配程序化动作
     */
    _matchProceduralAction(text) {
      if (!text) return null;
      const t = text.toLowerCase();
      const map = {
        'wave':      ['挥手', 'wave', 'hello', 'hi', '你好', '嗨'],
        'nod':       ['点头', 'nod', '同意', '对', '是的', '嗯'],
        'shakeHead': ['摇头', 'shake', '不', 'no', '不行', '拒绝'],
        'dance':     ['跳舞', 'dance', '嗨起来', '跳舞吧', 'dance'],
        'jump':      ['跳', 'jump', '蹦', '蹦跳', '高兴', '开心'],
        'clap':      ['鼓掌', 'clap', '拍手', 'bravo', '太棒了'],
        'spin':      ['旋转', 'spin', '转圈', 'turn'],
        'wiggle':    ['摇摆', 'wiggle', '扭', '扭屁股'],
      };
      for (const [action, keywords] of Object.entries(map)) {
        for (const kw of keywords) {
          if (t.includes(kw)) return action;
        }
      }
      return null;
    }

    /**
     * 将 getAvailableActions 返回的 action.name 映射为内部英文 key
     * 支持 "蹦跳 Jump"、"Jump"、"jump" 等各种格式
     */
    _resolveActionKey(actionName) {
      if (!actionName) return null;
      const t = actionName.toLowerCase().trim();
      const map = {
        'wave':      ['挥手 wave', 'wave'],
        'nod':       ['点头 nod', 'nod'],
        'shakehead': ['摇头 shakehead', 'shakehead'],
        'dance':     ['跳舞 dance', 'dance'],
        'jump':      ['蹦跳 jump', 'jump'],
        'clap':      ['鼓掌 clap', 'clap'],
        'spin':      ['旋转 spin', 'spin'],
        'wiggle':    ['摇摆 wiggle', 'wiggle'],
      };
      for (const [key, aliases] of Object.entries(map)) {
        for (const alias of aliases) {
          if (t === alias || t === alias.replace(/\s/g, '')) return key;
        }
      }
      return null;
    }

    /**
     * 播放程序化动画
     * actionName 可以是英文 key 或 getAvailableActions 返回的显示名
     */
    playProceduralAction(actionName) {
      // 清除之前的程序化动画
      this._stopAllProcedural();

      // 先尝试直接匹配 builder key
      let resolvedKey = actionName;
      const builders = {
        'wave':      () => this._animWave(),
        'nod':       () => this._animNod(),
        'shakeHead': () => this._animShakeHead(),
        'dance':     () => this._animDance(),
        'jump':      () => this._animJump(),
        'clap':      () => this._animClap(),
        'spin':      () => this._animSpin(),
        'wiggle':    () => this._animWiggle(),
      };

      // 如果直接匹配不到，尝试从显示名解析
      if (!builders[resolvedKey]) {
        resolvedKey = this._resolveActionKey(actionName);
      }

      if (resolvedKey && builders[resolvedKey]) {
        console.log('[GLTFRenderer] 🎬 播放程序化动画:', resolvedKey);
        this.proceduralAnims = builders[resolvedKey]();
        // 保存每个动画的起始值（用于回弹）
        for (const key of Object.keys(this.proceduralAnims)) {
          const anim = this.proceduralAnims[key];
          anim.startTime = this.clock.elapsedTime;
          if (anim.type === 'boneRotation') {
            anim.startValue = anim.bone.rotation.clone();
          } else if (anim.type === 'modelPosition') {
            anim.startValue = this.model.position.clone();
            console.log('[GLTFRenderer] 模型位置动画: 起始 y=', anim.startValue.y.toFixed(4), '位移 to.y=', anim.to.y.toFixed(4));
          } else if (anim.type === 'modelRotation') {
            anim.startValue = this.model.rotation.clone();
          }
        }
      } else {
        console.warn('[GLTFRenderer] 未知程序化动画:', actionName);
      }
    }

    _stopAllProcedural() {
      this.proceduralAnims = {};
    }

    /**
     * 更新程序化动画
     * 支持 ping-pong 模式：到达目标后自动回弹到初始位置
     * anim.loop 默认 true（来回弹），spin 等持续旋转设为 false
     */
    _updateProceduralAnimations(delta) {
      if (Object.keys(this.proceduralAnims).length === 0) return;

      const elapsed = this.clock.elapsedTime;
      let allDone = true;

      for (const key of Object.keys(this.proceduralAnims)) {
        const anim = this.proceduralAnims[key];
        const rawT = elapsed - anim.startTime;
        const duration = anim.loop === false ? anim.duration : anim.duration * 2; // ping-pong 总时长翻倍
        const progress = Math.min(rawT / duration, 1);

        if (progress >= 1) {
          // 动画结束，恢复初始值
          if (anim.type === 'boneRotation' && anim.startValue) {
            anim.bone.rotation.copy(anim.startValue);
          } else if (anim.type === 'modelPosition' && anim.startValue) {
            this.model.position.copy(anim.startValue);
          } else if (anim.type === 'modelRotation' && anim.startValue) {
            this.model.rotation.copy(anim.startValue);
          }
          continue;
        }

        allDone = false;

        // ping-pong: 前半段 0→1，后半段 1→0
        let eased;
        if (anim.loop === false) {
          // 不回弹：直接从 0 到 1
          eased = this._easeInOutSine(progress);
        } else {
          // ping-pong 回弹
          const half = progress * 2; // 0→2
          if (half <= 1) {
            eased = this._easeInOutSine(half);
          } else {
            eased = this._easeInOutSine(2 - half);
          }
        }

        if (anim.type === 'boneRotation') {
          this._applyBoneRotation(anim, eased);
        } else if (anim.type === 'modelPosition') {
          this._applyModelPosition(anim, eased);
          if (this._debugMode) {
            console.log('[GLTFRenderer] 动画位置: y=', this.model.position.y.toFixed(4), 'eased=', eased.toFixed(3));
          }
        } else if (anim.type === 'modelRotation') {
          this._applyModelRotation(anim, eased);
        }
      }

      if (allDone) {
        this.proceduralAnims = {};
        // 动画结束后自动重新对齐到底部
        this._realignToGround();
      }
    }

    _easeInOutSine(t) {
      return -(Math.cos(Math.PI * t) - 1) / 2;
    }

    _applyBoneRotation(anim, t) {
      if (!anim.bone) return;
      const sv = anim.startValue;
      anim.bone.rotation.x = sv.x + (anim.to.x - sv.x) * t;
      anim.bone.rotation.y = sv.y + (anim.to.y - sv.y) * t;
      anim.bone.rotation.z = sv.z + (anim.to.z - sv.z) * t;
    }

    _applyModelPosition(anim, t) {
      if (!this.model) return;
      const sv = anim.startValue;
      // to 表示相对于 startValue 的位移增量
      this.model.position.x = sv.x + anim.to.x * t;
      this.model.position.y = sv.y + anim.to.y * t;
      this.model.position.z = sv.z + anim.to.z * t;
    }

    _applyModelRotation(anim, t) {
      if (!this.model) return;
      const sv = anim.startValue;
      this.model.rotation.x = sv.x + (anim.to.x - sv.x) * t;
      this.model.rotation.y = sv.y + (anim.to.y - sv.y) * t;
      this.model.rotation.z = sv.z + (anim.to.z - sv.z) * t;
    }

    // ---- 动画定义 ----

    _bone(name) { return this.bones[name] || null; }
    _rot(name, x, y, z, dur) {
      return { type: 'boneRotation', boneName: name, bone: this._bone(name), to: { x, y, z }, duration: dur };
    }
    _pos(x, y, z, dur) {
      return { type: 'modelPosition', to: { x, y, z }, duration: dur };
    }
    _rotModel(x, y, z, dur) {
      return { type: 'modelRotation', to: { x, y, z }, duration: dur };
    }

    /**
     * 挥手 - 右臂举起反复摆动
     */
    _animWave() {
      const kb = this._findKeyBones();
      const arm = this._bone(kb['右臂 R.Arm']) || this._bone(kb['左臂 L.Arm']);
      const fore = this._bone(kb['右前臂 R.Fore']) || this._bone(kb['左前臂 L.Fore']);
      const anims = {};

      if (arm) {
        anims['arm'] = { type: 'boneRotation', boneName: arm.name, bone: arm, to: { x: 0, y: 0, z: -Math.PI * 0.7 }, duration: 1.2 };
      }
      if (fore) {
        anims['forearm'] = { type: 'boneRotation', boneName: fore.name, bone: fore, to: { x: 0, y: 0, z: -Math.PI * 0.4 }, duration: 0.8 };
      }

      // 无骨架时用整体旋转代替
      if (!arm && !fore) {
        anims['tilt'] = { type: 'modelRotation', to: { x: 0, y: 0, z: Math.PI * 0.1 }, duration: 0.5 };
      }
      return anims;
    }

    /**
     * 点头 - 头部上下摆动
     */
    _animNod() {
      const kb = this._findKeyBones();
      const head = this._bone(kb['头部 Head']) || this._bone(kb['脊柱 Spine']);
      const anims = {};

      if (head) {
        anims['head'] = { type: 'boneRotation', boneName: head.name, bone: head, to: { x: Math.PI * 0.15, y: 0, z: 0 }, duration: 0.6 };
      } else {
        // 无骨架：整体前倾
        anims['tilt'] = { type: 'modelRotation', to: { x: Math.PI * 0.1, y: 0, z: 0 }, duration: 0.6 };
      }
      return anims;
    }

    /**
     * 摇头 - 头部左右摆动
     */
    _animShakeHead() {
      const kb = this._findKeyBones();
      const head = this._bone(kb['头部 Head']) || this._bone(kb['脊柱 Spine']);
      const anims = {};

      if (head) {
        anims['head'] = { type: 'boneRotation', boneName: head.name, bone: head, to: { x: 0, y: Math.PI * 0.2, z: 0 }, duration: 0.6 };
      } else {
        anims['tilt'] = { type: 'modelRotation', to: { x: 0, y: Math.PI * 0.15, z: 0 }, duration: 0.6 };
      }
      return anims;
    }

    /**
     * 跳舞 - 身体扭动 + 手臂摆动
     */
    _animDance() {
      const kb = this._findKeyBones();
      const spine = this._bone(kb['脊柱 Spine']);
      const lArm = this._bone(kb['左臂 L.Arm']);
      const rArm = this._bone(kb['右臂 R.Arm']);
      const anims = {};

      if (spine) {
        anims['spine'] = { type: 'boneRotation', boneName: spine.name, bone: spine, to: { x: 0, y: Math.PI * 0.25, z: Math.PI * 0.1 }, duration: 1.0 };
      }
      if (lArm) {
        anims['larm'] = { type: 'boneRotation', boneName: lArm.name, bone: lArm, to: { x: 0, y: 0, z: Math.PI * 0.5 }, duration: 0.8 };
      }
      if (rArm) {
        anims['rarm'] = { type: 'boneRotation', boneName: rArm.name, bone: rArm, to: { x: 0, y: 0, z: -Math.PI * 0.5 }, duration: 0.8 };
      }

      if (!spine && !lArm && !rArm) {
        // 无骨架：整体摇摆 + 跳起
        anims['wiggle'] = { type: 'modelRotation', to: { x: 0, y: Math.PI * 0.3, z: Math.PI * 0.1 }, duration: 1.0 };
        anims['jump']   = { type: 'modelPosition', to: { x: 0, y: 0.3, z: 0 }, duration: 0.5 };
      }
      return anims;
    }

    /**
     * 蹦跳 - 向上弹起
     */
    _animJump() {
      const kb = this._findKeyBones();
      const lLeg = this._bone(kb['左腿 L.Leg']);
      const rLeg = this._bone(kb['右腿 R.Leg']);
      const anims = {};

      anims['jump'] = { type: 'modelPosition', to: { x: 0, y: 0.4, z: 0 }, duration: 0.5 };

      if (lLeg) {
        anims['lleg'] = { type: 'boneRotation', boneName: lLeg.name, bone: lLeg, to: { x: -Math.PI * 0.3, y: 0, z: 0 }, duration: 0.3 };
      }
      if (rLeg) {
        anims['rleg'] = { type: 'boneRotation', boneName: rLeg.name, bone: rLeg, to: { x: -Math.PI * 0.3, y: 0, z: 0 }, duration: 0.3 };
      }
      return anims;
    }

    /**
     * 鼓掌 - 双臂在身前合拢
     */
    _animClap() {
      const kb = this._findKeyBones();
      const lArm = this._bone(kb['左臂 L.Arm']);
      const rArm = this._bone(kb['右臂 R.Arm']);
      const anims = {};

      if (lArm) {
        anims['larm'] = { type: 'boneRotation', boneName: lArm.name, bone: lArm, to: { x: -Math.PI * 0.4, y: 0, z: -Math.PI * 0.3 }, duration: 0.5 };
      }
      if (rArm) {
        anims['rarm'] = { type: 'boneRotation', boneName: rArm.name, bone: rArm, to: { x: -Math.PI * 0.4, y: 0, z: Math.PI * 0.3 }, duration: 0.5 };
      }

      if (!lArm && !rArm) {
        anims['tilt'] = { type: 'modelRotation', to: { x: Math.PI * 0.1, y: 0, z: 0 }, duration: 0.5 };
      }
      return anims;
    }

    /**
     * 旋转 - 整体转一圈
     */
    _animSpin() {
      return {
        spin: { type: 'modelRotation', to: { x: 0, y: Math.PI * 2, z: 0 }, duration: 1.2, loop: false }
      };
    }

    /**
     * 摇摆 - 左右扭动
     */
    _animWiggle() {
      const kb = this._findKeyBones();
      const spine = this._bone(kb['脊柱 Spine']);
      const anims = {};

      if (spine) {
        anims['spine'] = { type: 'boneRotation', boneName: spine.name, bone: spine, to: { x: 0, y: 0, z: Math.PI * 0.15 }, duration: 0.5 };
      } else {
        anims['tilt'] = { type: 'modelRotation', to: { x: 0, y: 0, z: Math.PI * 0.12 }, duration: 0.5 };
      }
      return anims;
    }

    // ==================== 工具方法 ====================

    setScale(scale) {
      this.userScale = scale || 1;
      if (this.model && this.baseScale > 0) {
        this.model.scale.setScalar(this.baseScale * this.userScale);
        console.log('[GLTFRenderer] setScale:', this.userScale.toFixed(4), 'final:', (this.baseScale * this.userScale).toFixed(4));
      }
    }

    destroy() {
      this._stopAutoAnimation();
      this._stopAllProcedural();
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
      if (this.mixer) {
        this.mixer.stopAllAction();
        this.mixer = null;
      }
      if (this.model) {
        this.scene && this.scene.remove(this.model);
        this.model = null;
      }
      if (this.renderer) {
        this.renderer.dispose();
        this.renderer = null;
      }
      if (this.container) {
        this.container.innerHTML = '';
      }
    }
  }

  // Export
  window.GLTFRenderer = GLTFRenderer;
  console.log('[GLTFRenderer] Class registered');

})();
