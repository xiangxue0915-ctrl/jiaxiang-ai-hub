# 嘉享AI助手 - 可部署包

本目录为可直接部署的静态网站包（`index.html` 为入口）。

## 使用方式

### 方式一：本地离线运行
```bash
cd deploy
python -m http.server 8080
# 浏览器访问 http://localhost:8080
```

### 方式二：部署到 GitHub Pages（正式网址）
1. 在 GitHub 新建一个空仓库（不要勾选 README）。
2. 在本目录执行（把 <用户名>/<仓库名> 换成你的）：
   ```bash
   git init -b main
   git config --global core.quotepath false
   git add -A
   git commit -m "publish 嘉享AI助手"
   git remote add origin https://github.com/<用户名>/<仓库名>.git
   git push -u origin main
   ```
3. 仓库 Settings → Pages → Source 选 `Deploy from a branch`，分支 `main` / 目录 `/ (root)`，Save。
4. 约 1~2 分钟后访问 `https://<用户名>.github.io/<仓库名>/`。

> 仓库名若命名为 `<用户名>.github.io`，可省去末尾路径，直接 `https://<用户名>.github.io/`。

### 方式三：部署到腾讯云 COS / 阿里云 OSS
1. 把整个 `deploy/` 目录上传到对象存储桶。
2. 开启静态网站托管，设置默认首页为 `index.html`。
3. 配置自定义域名（可选），拿到访问链接发给销售。

## 文件访问说明
- 资源库中的文件已复制到 `deploy/files/`，元数据路径为相对路径 `files/xxx`。
- 无论部署在域名根目录还是子路径（如 GitHub Pages 的 `/仓库名/`），"打开文件"都能正确下载。
- 本包已包含 `.nojekyll`，禁用 GitHub Pages 的 Jekyll 处理，避免静态资源被忽略。
- 文件较大（PPT 最大约 40MB），首次打开稍慢属正常。

## 安全提示
本包包含 360 产品资料，请确保仓库设为 Private 或仅分发给授权人员。
如使用 GitHub Pages，请确认公司允许将资料托管在 GitHub（境外服务器）。
