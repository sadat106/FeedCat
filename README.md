# 🐱 Feed Cat - VS Code Coding Companion

一只可爱的小猫陪伴你编程！它住在 VS Code 底部面板中，每当你敲击键盘，小猫头顶的计数器就会增加。每敲击1000次，就会掉落一条小鱼，小猫会跑过去吃掉它！

## 🎬 效果展示

小猫会显示在 VS Code **底部面板区域**（和终端、问题面板同一行），包含：
- 🌤️ 蓝天白云的可爱背景
- 🐱 会动的像素小猫
- ⌨️ 实时击键计数器（显示在小猫头顶）
- 🐟 自动掉落的小鱼奖励

## 📦 安装方法

### 方法一：安装 .vsix 文件（推荐）

1. 下载 `feedcatv2-0.0.1.vsix` 文件
2. 在 VS Code 中按 `Ctrl+Shift+P`
3. 输入 `Extensions: Install from VSIX...`
4. 选择下载的 `.vsix` 文件
5. 重新加载 VS Code

### 方法二：开发模式运行

1. 用 VS Code 打开此项目文件夹
2. 按 `F5` 启动调试
3. 在新打开的窗口中使用插件

## 🚀 使用方法

安装后，小猫面板会自动出现在底部面板区域。如果没有看到：

1. 按 `Ctrl+Shift+P`
2. 输入 `Feed Cat: Show Cat`
3. 或者在底部面板区域右键，选择显示 "Feed Cat" 面板

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 🐱 精灵动画 | 小猫有多种动作：站立、走路、跑步、坐下、吃东西 |
| ⌨️ 按键计数 | 实时统计你的击键次数，显示在小猫头顶 |
| 🐟 小鱼奖励 | 每1000次击键，随机位置掉落一条小鱼 |
| 🏃 智能行为 | 小猫会主动跑向小鱼并吃掉它 |
| 🎲 随机漫游 | 空闲时小猫会随机走动或休息 |

## ⚙️ 配置选项

在 VS Code 设置中搜索 `feedcat`：

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| `feedcat.fishThreshold` | `1000` | 触发小鱼掉落的击键次数 |

## 🎮 命令列表

| 命令 | 说明 |
|------|------|
| `Feed Cat: Show Cat` | 显示/聚焦小猫面板 |
| `Feed Cat: Reset Counter` | 重置击键计数器 |
| `Feed Cat: Spawn Fish` | 手动生成一条小鱼（测试用） |

## 🛠️ 开发

```bash
# 安装依赖
npm install

# 编译
npm run compile

# 监听模式
npm run watch

# 打包
npx @vscode/vsce package --allow-missing-repository
```

## 🎨 精灵图规格

- 文件：`media/cat-sprite.png`
- 尺寸：256 x 320 像素
- 帧大小：32 x 32 像素
- 布局：8 列 x 10 行
- 显示尺寸：64 x 64 像素 (2x 缩放)

## 📁 项目结构

```
feedcatv2/
├── media/
│   └── cat-sprite.png      # 小猫精灵图
├── src/
│   ├── extension.ts        # 插件入口
│   └── CatViewProvider.ts  # Webview 视图提供者
├── out/                    # 编译输出
├── package.json            # 插件配置
└── feedcatv2-0.0.1.vsix   # 打包好的插件
```

## 📝 许可证

MIT License

---

🐱 **享受编程，喂养你的小猫伙伴！** 🐟
