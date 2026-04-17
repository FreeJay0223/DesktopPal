# 🐾 DesktopPal

> Your Windows Desktop AI Companion - An Electron + Live2D/GLTF Desktop Pet Application
>
> ⚡ This project is AI-assisted

[English](./README_en.md) | [简体中文](./README.md)

---

## ✨ Features

### 🤖 AI Smart Companion
- Support for various AI model APIs (OpenAI, Claude, local models, etc.)
- Customizable AI companion personality
- Natural conversation experience

### 🎭 Multi-Model Support
- **3D Models**: Support GLTF/GLB format 3D models
- **Live2D Models**: Support Live2D dynamic illustrations
- **Static Images**: Support regular images with animation effects
- Model management panel for easy switching

### 🎬 Rich Animations
- Built-in 3D animations (wave, clap, dance, etc. 120+ animations)
- Procedural animations
- Auto idle motions
- Draggable and interactive

### 🛠️ Useful Tools
- 💬 **AI Chat**: Real-time conversation with companion
- 📋 **Todo List**: Manage daily tasks
- ⏱️ **Pomodoro Timer**: Focus work and break
- ⚡ **Quick Actions**: Open frequently used apps quickly

### 💻 Desktop Integration
- 🚀 **Auto Start**: Start with system
- 🔔 **System Tray**: Run in background, quick access
- 📌 **Always on Top**: Always visible on desktop
- 🎯 **Transparent Window**: Doesn't block wallpaper

---

## 🎬 Demo

![Demo](assets/demo.gif)

---

## 🎯 Quick Overview (6 Steps to Your AI Companion)

Want an AI desktop companion based on your likeness? Just 6 steps:

1. 📸 **Generate Cartoon Avatar** - Use AI to convert your photo to cartoon full-body image
2. 🎭 **Generate 3D Model** - Use AI platform to create GLB format 3D model
3. 💃 **Bind Skeleton & Animation** - Use [Mesh2Motion](https://github.com/Mesh2Motion/mesh2motion-app) to generate animations
4. 🧠 **Create Personality** - Use AI or distill chat history for personalized personality
5. 🔑 **Get API Key** - Register on LLM platform
6. 🚀 **Run & Configure** - Set API, personality, avatar, restart and enjoy!

👉 [View Detailed Tutorial](#-complete-user-guide)

---

## 🚀 Quick Start

### Requirements
- Windows 10 or higher
- Node.js 16+ (Node.js 18 recommended)
- npm or yarn

### Install Dependencies

```bash
# Clone repository
git clone <repository-url>
cd desktop-friend

# Install dependencies
npm install
```

### Run Development Version

```bash
# Start application
npm start

# Or with UTF-8 encoding (fix Chinese characters)
npm run start:utf8
```

### 🏗️ Build for Production

```bash
# Build Windows installer
npm run build

# Or build unpacked version
npm run build:dir
```

Built packages are located in the `dist/` directory.

---

## 📖 Complete User Guide

This application requires a complete AI companion avatar and personality. Here's the complete workflow to create your专属 AI companion:

---

#### Step 1: Generate Cartoon-Style Avatar

Use AI image generation tools to convert your photo into a cartoon-style full-body image.

**Recommended Tools:**
- **Midjourney** - Use `/imagine` with reference image and prompts
- **Stable Diffusion** - Local deployment, supports ControlNet for pose control
- **DALL-E 3** - OpenAI's official image generation
- **Ideogram/Flux/Kling** - Other AI image tools

**Prompt Example:**
```
A cute cartoon character full body illustration, anime style, 
transparent background, high quality, detailed, 4K
```

> 💡 **Tip**: Keep original photo features (hairstyle, clothing style) to make the cartoon more personal.

---

#### Step 2: Generate 3D Model (GLB Format)

Upload the cartoon avatar to an AI platform to generate a 3D character model.

**Recommended Platforms:**
- **Meshy AI** (meshy.ai) - Text/image to 3D, supports GLB export
- **Tripo3D** (tripo3d.ai) - Fast generation with textures
- **Ready Player Me** - Photo-based Avatar generation
- **Avatarify** - Real-time 3D avatar generation

**Steps:**
1. Upload cartoon avatar
2. Select target format (GLB recommended)
3. Wait for AI generation (1-5 minutes)
4. Download GLB file

> 💡 **Note**: Choose front-facing standing pose for easier skeleton binding.

---

#### Step 3: Bind Skeleton & Generate Animation

Use open-source tools to bind skeleton to static model and generate animated GLB files.

**Recommended Tool:**
- **Mesh2Motion** (https://github.com/Mesh2Motion/mesh2motion-app)
  - Specifically for converting static models to animated GLB with skeleton
  - Supports multiple preset animations (standing, walking, dancing, etc.)

**Steps:**
1. Open Mesh2Motion app
2. Import GLB model from Step 2
3. Select skeleton template (humanoid/cartoon, etc.)
4. Auto-bind skeleton
5. Select animation library or generate custom animations
6. Export animated GLB file



---

#### Step 4: Generate AI Companion Personality

Use AI to create unique personality settings for your companion.

**Method 1: Direct AI Generation**
```markdown
# Companion Personality

## Background
My name is Snow, a cheerful and outgoing college student...

## Personality Traits
- Optimistic and positive, always spreading good energy
- Love sharing interesting things
- Care about user's emotional state

## Speaking Style
- Warm and natural tone
- Occasionally use cute emoticons
- Adjust expression based on topic
```

**Method 2: Distill Chat History (Advanced)**
- Use distillation projects on GitHub to train personalized personality from WeChat/QQ chat history
- Reference: CharacterAI-like local distillation solutions

> ⚠️ **Data Security Reminder**: Distilling chat history involves personal privacy:
> 1. De-identify data before uploading (remove ID numbers, bank cards, real names, etc.)
> 2. Use trusted local deployment solutions
> 3. **This project plans to develop a local WeChat chat history de-identification tool** for safe LLM distillation

---

#### Step 5: Get AI LLM API Key

Register on major LLM platforms and get an API Key.

**Recommended Platforms:**

| Platform | Features | Website |
|----------|----------|---------|
| OpenAI | GPT-4o/GPT-4 best quality | platform.openai.com |
| Claude (Anthropic) | Strong long-text understanding | console.anthropic.com |
| SiliconFlow | China available, cheap tokens | cloud.siliconflow.cn |
| Alibaba Tongyi | Qwen series optimized for Chinese | dashscope.console.aliyun.com |
| Baidu Wenxin | ERNIE series | console.bce.baidu.com |
| Zhipu GLM | ChatGLM local optimization | open.bigmodel.cn |

> 💡 **Ark Coding Plan** - Supports Doubao, GLM, DeepSeek, Kimi, MiniMax and more. Unlimited tools! **20% OFF**, starting at just **$5/month**!
> 
> [Subscribe Now](https://volcengine.com/L/oEXSZUuR0vU/) | Referral Code: `TYCADEFV`

**Steps:**
1. Register and complete real-name verification
2. Go to API Key management page
3. Create new API Key
4. Copy and save securely (don't share with others)

---

#### Step 6: Run & Configure

1. **Start Application**
   ```bash
   # Development mode
   npm start
   
   # Or run packaged app
   Double-click .exe in dist/ folder
   ```

2. **Set API Key**
   - Click ⚙️ Settings icon
   - Fill in API address (e.g., OpenAI: `https://api.openai.com/v1`)
   - Fill in API Key

3. **Set Companion Personality**
   - Open personality settings panel
   - Import `.md` personality document from Step 4
   - Or paste custom system prompt directly

4. **Set Companion Avatar**
   - Click 🎭 Model Manager icon
   - Import animated GLB file from Step 3
   - Preview animation effects

5. **Restart Application**
   - Restart program after configuration
   - Your AI companion will appear with new avatar!

---

### 💬 Basic Chat Feature

After configuration, you can:
- Click 💬 icon to open chat window
- Enter messages to chat with AI companion
- Companion responds with actions and expressions
- Voice input supported (if configured)

### Quick Operations

| Action | Description |
|--------|-------------|
| Open Settings | Click ⚙️ or Right-click → Settings |
| Open Model Manager | Click 🎭 |
| Open Chat | Click 💬 |
| Open DevTools | `Ctrl + Shift + I` or `F12` |
| Exit | Right-click tray → Exit |

---

## 📁 Project Structure

```
desktop-friend/
├── main.js                 # Electron main process
├── preload.js              # Preload script
├── package.json            # Project configuration
├── assets/                 # Resource files
│   ├── icon.ico           # Application icon
│   ├── icon.png           # PNG icon
│   ├── donate-wechat.jpg  # WeChat donation QR
│   └── donate-alipay.jpg  # Alipay donation QR
├── models/                 # 3D/Live2D models
├── src/                    # Renderer process source
│   ├── index.html         # Main interface
│   ├── chat-window.html   # Chat window
│   ├── model-manager.html # Model manager
│   ├── settings.html      # Settings page
│   ├── scripts/           # JavaScript scripts
│   │   ├── renderer.js    # Main renderer
│   │   ├── gltf-renderer.js # 3D model renderer
│   │   ├── live2d-renderer.js # Live2D renderer
│   │   └── ...
│   └── styles/            # CSS styles
├── dist/                   # Build output
└── logs/                   # Log files
```

---

## ⚙️ Configuration

### Config File Location

Config file stored in user directory:
```
C:\Users\<Username>\AppData\Roaming\desktop-pet\config.json
```

### Main Config Items

| Config | Description | Default |
|--------|-------------|---------|
| apiEndpoint | AI API address | empty |
| apiKey | AI API key | empty |
| apiProvider | API provider | openai |
| model | AI model | gpt-3.5-turbo |
| autoStart | Auto start with system | true |
| alwaysOnTop | Window always on top | true |
| petName | Companion name | empty |
| userName | User name | empty |
| currentLive2DModel | Current model | default model |

### Reset Configuration

To reset all configurations, delete this file:
```powershell
Remove-Item "$env:APPDATA\desktop-pet\config.json" -Force
```

---

## 💝 Donations

If this project helps you, please consider supporting the developer:

| Method | QR Code |
|--------|---------|
| WeChat Pay | ![WeChat Donation](assets/donate-wechat.jpg) |
| Alipay | ![Alipay Donation](assets/donate-alipay.jpg) |

---

## 🛠️ Professional Services

### Paid Deployment Service

If you don't want to configure yourself or encounter technical issues, we offer professional paid deployment services:

**Services Include:**
- ✅ Remote desktop assistance deployment (Windows)
- ✅ AI model configuration and optimization
- ✅ 3D model format conversion and optimization
- ✅ Skeleton binding and animation processing
- ✅ Program customization

**Service Advantages:**
- 🔒 **Privacy Protection**: All operations via remote desktop, no third-party servers
- ⏱️ **Fast Response**: Most issues resolved same day
- 💰 **Fair Pricing**: Based on actual workload

**Contact:**
- 📧 Email: [your-email@example.com]
- 💬 WeChat: [your-wechat-id]

> 💡 **Remote Deployment Note**: We use remote control software (AnyDesk, Sunflower) to directly connect to your computer. All operations are done under your supervision. You can see the screen content at any time, ensuring privacy.

---

## ⚠️ Disclaimer

**Please read the following terms carefully. Using this project means you agree to the following disclaimer:**

### 1. Data Security Responsibility

- 🔒 All configuration data (including API Keys, personality settings, etc.) is stored on user's local device
- 🔒 Chat history distillation involves personal privacy data, **you are responsible for data de-identification and security**
- 🔒 Before using any online tools for model training or distillation, ensure you have removed sensitive information like ID numbers, bank cards, phone numbers, real names
- ⚠️ Project developers are not responsible for any losses caused by data leakage

### 2. AI-Generated Content

- 🤖 AI chat feature is provided by third-party LLMs, generated content does not represent project developers' views
- 🤖 AI-generated content may contain factual errors, bias, or inappropriate content, please use judgment
- 🤖 Users are responsible for all actions and consequences from chatting with AI via this program

### 3. Model File Source

- 🎭 Ensure you have legal rights to use any 3D model files you import
- 🎭 Do not use model files that infringe on others' intellectual property
- 🎭 Project developers are not responsible for user's model usage

### 4. Software Use

- 💻 This program is provided "AS IS" without any express or implied warranty
- 💻 Project developers are not responsible for any direct or indirect losses from using this program
- 💻 This program may have bugs or compatibility issues, please understand

---

## 📜 License

### MIT License

This project is licensed under the **MIT License**, one of the most permissive open source licenses:

```
MIT License

Copyright (c) 2024 Desktop Friend

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

**This means you can:**
- ✅ Freely use, copy, modify this project
- ✅ Commercial use (paid deployment services are completely legal)
- ✅ Distribute, private deployment
- ✅ Create derivative works

**Just meet:**
- 📝 Keep the original copyright notice

---

## 🔧 FAQ

### Q: Tray icon not showing?
A: Click the up arrow in taskbar to expand hidden icons area and find Desktop Friend icon.

### Q: How to make tray icon always visible?
A: Right-click taskbar → Taskbar settings → Notification area → Select which icons appear on taskbar → Enable Desktop Friend.

### Q: 3D model loading failed?
A: Ensure model file is valid GLTF/GLB format and located in models/ directory.

### Q: AI chat not working?
A: Check if API address and key are configured correctly.

### Q: How to export/import config?
A: There's export/import personality config feature in settings page.

### Q: How to generate personalized personality from chat history?
A: You can use distillation projects on GitHub to train personalized AI personality from WeChat/QQ chat history.
   ⚠️ **Important**: Be sure to de-identify chat history before distillation, remove sensitive info like ID numbers, bank cards, phone numbers.
   📌 This project plans to develop a local WeChat chat history de-identification tool for safe LLM distillation.

### Q: Is remote deployment service safe?
A: We use remote control software to directly connect to your computer, all operations are done under your supervision.
   - Data doesn't go through third-party servers
   - You can see screen content at any time
   - Can disconnect immediately after completion
   - Recommended to change API Key after operation

---

## 🛡️ Security Notes

- ⚠️ Sensitive info like API keys are stored in user's local directory, not in packaged files
- 💡 Recommended to regularly backup config: `%APPDATA%\desktop-pet\config.json`
- 🔒 Don't commit API keys to code repository

---

## 📝 Development Guide

### Adding New Features

1. Create or modify files in `src/` directory
2. For new panels, reference existing HTML structure
3. Use IPC communication with main process

### Debug Tips

- Open DevTools: `Ctrl + Shift + I`
- View log file: `%APPDATA%\desktop-pet\logs\app.log`
- Restart app: `npm start`

### Code Standards

- Use ESLint for code linting
- Follow Electron security best practices
- Prevent XSS attacks

---

## 🤝 Contributing

Issues and Pull Requests are welcome!

1. Fork this repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Create Pull Request

---

## 🙏 Acknowledgments

- [Electron](https://electronjs.org/) - Desktop app framework
- [PixiJS Live2D Display](https://github.com/guansss/pixi-live2d-display) - Live2D rendering
- [Three.js](https://threejs.org/) - 3D rendering engine
- [Lottie](https://airbnb.design/lottie/) - Animation solution


---

<p align="center">
  <strong>If this project helps you, please give a ⭐️</strong>
</p>
