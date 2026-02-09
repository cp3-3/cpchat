import json
import os
from typing import Any, Dict, List

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from openai import OpenAI

# 加载 .env 文件（如果存在）
load_dotenv()

"""
后端：将 ModelScope(OpenAI 兼容) 的流式输出转成 SSE，供前端 fetch 读取。

前端期望的格式（每次增量一行）：
data: {"content":"..."}\n\n
"""

MODELSCOPE_BASE_URL = os.environ.get("MODELSCOPE_BASE_URL", "https://api-inference.modelscope.cn/v1")
MODELSCOPE_MODEL_ID = os.environ.get("MODELSCOPE_MODEL_ID", "Qwen/Qwen3-32B")
MODELSCOPE_TOKEN = 'ms-3edb6857-7b64-4490-bf5d-4e6313bfa643'

app = FastAPI()

# 添加 CORS 支持（允许前端跨域请求）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应该指定具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def make_client() -> OpenAI:
  if not MODELSCOPE_TOKEN:
    raise RuntimeError("MODELSCOPE_TOKEN is not set")
  # 调试：打印 Token 前几位和后几位（不完整显示，避免泄露）
  token_preview = f"{MODELSCOPE_TOKEN[:10]}...{MODELSCOPE_TOKEN[-6:]}" if len(MODELSCOPE_TOKEN) > 16 else "***"
  print(f"[DEBUG] 使用 Token: {token_preview} (长度: {len(MODELSCOPE_TOKEN)})")
  return OpenAI(base_url=MODELSCOPE_BASE_URL, api_key=MODELSCOPE_TOKEN)


@app.post("/api/chat/stream")
async def chat_stream(req: Request):
  body: Dict[str, Any] = await req.json()
  messages: List[Dict[str, str]] = body.get("messages") or []
  content: str = body.get("content") or ""

  print(f"[DEBUG] 收到请求: content={content[:50]}...")  # 调试日志

  upstream_messages = [*messages, {"role": "user", "content": content}]

  def gen():
    try:
      client = make_client()
      print(f"[DEBUG] 调用 ModelScope API: model={MODELSCOPE_MODEL_ID}")
      resp = client.chat.completions.create(
        model=MODELSCOPE_MODEL_ID,
        messages=upstream_messages,
        stream=True,
      )
      chunk_count = 0
      for chunk in resp:
        if not getattr(chunk, "choices", None):
          continue
        delta = chunk.choices[0].delta.content or ""
        if delta:
          chunk_count += 1
          yield f"data: {json.dumps({'content': delta}, ensure_ascii=False)}\n\n"
      print(f"[DEBUG] 流式输出完成，共 {chunk_count} 个增量块")
      yield "data: {\"done\": true}\n\n"
    except Exception as e:
      error_msg = str(e)
      print(f"[ERROR] ModelScope API 错误: {error_msg}")  # 调试日志
      yield f"data: {json.dumps({'error': error_msg}, ensure_ascii=False)}\n\n"

  return StreamingResponse(
    gen(),
    media_type="text/event-stream",
    headers={
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  )

