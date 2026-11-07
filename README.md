# 声渡 · SoundPort

在浏览器本地转换音频格式的开源工具。当前支持将 NCM 解封装为 MP3 / FLAC，后续可扩展其他音频封装。
**HTML + CSS + JavaScript，无后端，无构建步骤，可部署至 GitHub Pages。**

## 功能

- 多选或拖入 NCM，顺序批量处理。
- 后台 Worker 转换，不阻塞主界面；可取消当前文件、移除等待项或清空列表。
- 按实际音频头识别 MP3 / FLAC，不仅依赖元数据，不重新编码。
- 单首下载，或 ZIP 打包下载；ZIP 内同名文件自动编号。
- 文件只在本机浏览器内处理，没有上传接口、外部 CDN、字体请求或统计脚本。
- 所需 CryptoJS 固定版本已放在 `vendor/`，无需 npm install。
- MIT 开源许可，第三方许可随源码附带。

## 本地运行

安装 Python 3 后，在项目目录运行：

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

打开 http://127.0.0.1:8080 ，选择 NCM 文件。结果可单独下载，也可点击“打包下载 ZIP”。
按 Ctrl+C 停止服务。

需要通过 HTTP 或 HTTPS 打开；直接双击 `index.html` 的 `file://` 页面不能可靠运行 Worker。
推荐使用支持 Worker、Blob 和 OKLCH CSS 的现代浏览器。

## 发布至 GitHub Pages

1. 创建 GitHub 仓库（例如 `soundport`），把**本项目目录内的文件**放到仓库根目录。
2. 使用 `main` 分支，保留 `.github/workflows/`、`vendor/`、许可证等文件。
3. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
4. 推送代码；如果先前的部署因尚未启用 Pages 失败，在 **Actions → Test and deploy Pages → Run workflow** 重新运行。
5. 测试通过后自动部署，网页地址显示在 Pages 设置页及工作流部署结果中。

通常地址形如 `https://你的用户名.github.io/soundport/`。
所有资源路径均为相对路径，兼容仓库子路径。工作流只发布明确列出的网页资源，不发布测试、音乐或整个仓库。

也可在 Pages 中选择 **Deploy from a branch → main → /(root)**，直接发布静态文件；此方式不必使用部署工作流。

官方文档：https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

## 格式与限制

- MP3 来源输出 `.mp3`；FLAC 来源输出 `.flac`。**本版本不做 FLAC → MP3 有损转码。**
- 不额外写入歌曲标签或封面；音频载荷中原有的标签会随字节保留。
- 单文件 128 MiB，每批最多 256 MiB / 100 首。浏览器内存用量会高于输入大小，尤其打包时；内存有限的设备请分批处理。
- 元数据损坏时，尽可能根据音频头恢复；密钥损坏、封面区长度错误或未知音频格式会显示错误。
- 未覆盖所有 NCM 变体；不能解开其他音乐格式封装。
- 文件头检查不等同于完整音频完整性校验：中段损坏的音频仍可能被导出，容器 CRC 字段目前不校验。
- 清空列表会取消处理并释放结果引用；已下载的文件不会被删除。

## 测试

安装 Node.js 22 或更新版本后：

```sh
npm test
```

测试由 Node 自带测试框架执行，覆盖 MP3 字节保真、FLAC 格式识别、损坏或缺失元数据、封面预留填充、截断与异常长度、MPEG 头检测、ZIP CRC 与目录结构。
测试样本由 Node 原生 AES 生成，不包含真实歌曲。

开发验证结果（2026-11-07）：

- 7 项自动测试通过。
- 12 个本地真实 NCM 文件成功解封装，FFprobe 确认为 320 kbps / 48 kHz MP3，FFmpeg 全曲解码未报告错误。
- 浏览器初始页面已检查；由于文件选择权限未获批准，网页选文件、下载和取消的端到端流程未完成验证。
- FLAC 使用合成样本验证格式与字节保真，尚未以真实 FLAC 来源的 NCM 文件验证。

## 项目结构

| 文件 | 用途 |
| --- | --- |
| `index.html` / `style.css` / `tokens.css` | 页面与样式 |
| `app.js` | 队列、状态、取消、下载 |
| `core.js` / `worker.js` | NCM 解析、AES 解封装、音频恢复 |
| `zip.js` / `zip-worker.js` | UTF-8 ZIP32 STORE 打包 |
| `vendor/` | 本地 CryptoJS 4.2.0 及许可证 |
| `tests/` | 合成样本与自动测试 |
| `.github/workflows/` | PR 测试与 Pages 发布 |

## 参与开发

请在 PR 中说明问题、修改和验证方法，并运行 `npm test`。
复现问题优先使用合成样本或脱敏的区块长度信息；不要提交真实歌曲、封面或账号数据。
修改文件解析时需添加异常长度和损坏文件测试。

本项目与网易云音乐无隶属关系。软件采用 MIT 许可，音乐内容的权利不随软件许可证转移。
