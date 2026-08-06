# 岐黄阁 · GitHub Pages 部署指南

## 兼容性说明

岐黄阁是**纯前端静态站点**，已适配 GitHub Pages 部署：

- ✅ 路由：Hash 模式（`#/home`），无刷新导航，完全兼容 GitHub Pages
- ✅ 路径：全部相对路径，子目录部署无需额外配置
- ✅ 数据存储：localStorage（按用户隔离），无需后端
- ✅ 体验链接：数据嵌入 URL 参数，无需服务端支持
- ✅ 字体：Google Fonts（CDN），支持内网回退

## 部署步骤

### 第一步：创建 GitHub 仓库

1. 登录 [github.com](https://github.com)
2. 点击右上角 **New repository**
3. 填写：
   - Repository name: `qihuangge`（或你喜欢的名字）
   - Description: `岐黄阁 · 中医药古籍知识推理系统`
   - 勾选 **Public**（免费）
   - 不勾选 "Add a README"（已有文件）
4. 点击 **Create repository**

### 第二步：推送代码

仓库创建后，按页面提示操作：

```bash
# 初始化 git（如果还没有）
cd e:\岐黄阁
git init
git add .
git commit -m "Initial commit: 岐黄阁 v1.0"

# 添加远程仓库（替换为你的 GitHub 用户名和仓库名）
git remote add origin https://github.com/你的用户名/qihuangge.git
git branch -M main
git push -u origin main
```

### 第三步：启用 GitHub Pages

1. 进入仓库 → **Settings** → **Pages**（左侧菜单）
2. **Source** 选择 `Deploy from a branch`
3. **Branch** 选择 `main`，目录选 `/ (root)`
4. 点击 **Save**
5. 等待 1-2 分钟，页面顶部会显示：
   > Your site is live at `https://你的用户名.github.io/qihuangge/`

### 第四步：验证体验链接

1. 访问 `https://你的用户名.github.io/qihuangge/`
2. 新建用户档案 → 完成辨证体质测试
3. 进入「用户档案」→ 选择档案 → 点击「🔗 生成分享链接」
4. 复制链接发给任何人，对方打开即可看到完整存档

## 注意事项

### 体验链接长度

分享链接会携带完整存档数据，URL 长度约 8-20KB，完全在浏览器限制内。但如果数据量很大，建议压缩后再分享。

### 字体加载

页面使用 Google Fonts，国内用户可能需要梯子。如需完全离线可用，可将字体下载到本地 `static/fonts/` 目录。

### app.py 不需要

`app.py` 是本地开发用 Python 服务器，GitHub Pages 部署后**不需要**，直接忽略。

## 自定义域名（可选）

1. 准备域名（如 `tcm.example.com`）
2. 在 GitHub 仓库 **Settings → Pages → Custom domain** 填写域名
3. 在域名 DNS 中添加 CNAME 记录：
   ```
   tcm.example.com → 你的用户名.github.io.
   ```
4. 仓库根目录创建 `CNAME` 文件，内容只有一行：
   ```
   tcm.example.com
   ```
5. GitHub 会自动生成 HTTPS 证书

## 更新部署

代码修改后推送即可自动部署：

```bash
git add .
git commit -m "更新内容"
git push origin main
```

GitHub Pages 通常 1-2 分钟内自动生效。
