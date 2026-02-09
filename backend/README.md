# YuanAI 后端服务

基于 FastAPI 的 ModelScope GLM 流式代理服务。

## 快速开始

### 1. 安装依赖

```bash
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
# Linux/Mac
source .venv/bin/activate

pip install -r requirements.txt
```

### 2. 配置 Token（三种方式任选其一）

#### 方式 A：使用 .env 文件（推荐）

在 `backend/` 目录下创建 `.env` 文件：

```env
MODELSCOPE_TOKEN=你的ModelScopeToken
MODELSCOPE_MODEL_ID=ZhipuAI/GLM-4.7-Flash
MODELSCOPE_BASE_URL=https://api-inference.modelscope.cn/v1
```

**注意**：`.env` 文件已加入 `.gitignore`，不会被提交到 Git。

#### 方式 B：PowerShell 环境变量

```powershell
$env:MODELSCOPE_TOKEN="你的Token"
$env:MODELSCOPE_MODEL_ID="ZhipuAI/GLM-4.7-Flash"
$env:MODELSCOPE_BASE_URL="https://api-inference.modelscope.cn/v1"
```

#### 方式 C：直接修改代码（不推荐，仅用于测试）

在 `server.py` 第 18 行直接写：

```python
MODELSCOPE_TOKEN = "你的Token"  # 不推荐，会泄露到代码仓库
```

### 3. 启动服务

```bash
uvicorn server:app --host 0.0.0.0 --port 3000 --reload
```

服务将在 `http://localhost:3000` 启动。

## API 接口

### POST /api/chat/stream

流式聊天接口，返回 SSE 格式。

**请求体**：
```json
{
  "chatId": "会话ID",
  "messages": [],  // 历史消息（可选）
  "content": "用户输入"
}
```

**响应格式**（SSE）：
```
data: {"content":"你好"}
data: {"content":"，"}
data: {"content":"我是"}
...
data: {"done":true}
```

## 安全提醒

⚠️ **永远不要**：
- 把 Token 提交到 Git 仓库
- 在前端代码中硬编码 Token
- 在公开的聊天/文档中分享 Token

✅ **应该**：
- 使用环境变量或 `.env` 文件
- 将 `.env` 加入 `.gitignore`
- 定期轮换 Token