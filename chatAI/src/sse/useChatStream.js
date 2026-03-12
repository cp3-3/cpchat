import { useCallback, useEffect, useRef } from "react";
import { useChatStore } from "../store/chatStore";

// 基于 fetch + ReadableStream 的 SSE 实现，带缓冲与 requestAnimationFrame 批量更新

// 打字机效果配置：每次刷新显示的字符数（调小这个值可以减慢速度）
const TYPEWRITER_CHARS_PER_FRAME = 2; // 每帧显示2个字符
// 打字机效果配置：刷新间隔毫秒数（调大这个值可以减慢速度）
const TYPEWRITER_INTERVAL_MS = 30; // 每30毫秒刷新一次

export function useChatStream(chatId) {
  const abortControllerRef = useRef(null);
  const bufferRef = useRef("");
  const frameIdRef = useRef(null);
  const lastFlushTimeRef = useRef(0);
  /** 跨 read() 累积的不完整行，避免 SSE 行被拆成多个 chunk 时解析失败 */
  const lineBufferRef = useRef("");

  const appendMessage = useChatStore((s) => s.appendMessage);
  const updateLastAssistantMessage = useChatStore(
    (s) => s.updateLastAssistantMessage,
  );
  const setStreamingState = useChatStore((s) => s.setStreamingState);

  /** 将 buffer 中剩余内容一次性写入最后一条助手消息（流结束或中止时调用，避免内容被截断） */
  const flushBufferToStore = useCallback(() => {
    const remaining = bufferRef.current;
    if (remaining) {
      updateLastAssistantMessage(chatId, (last) => ({
        ...last,
        content: (last.content ?? "") + remaining,
      }));
      bufferRef.current = "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  const stopStream = useCallback(() => {
    flushBufferToStore();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (frameIdRef.current) {
      cancelAnimationFrame(frameIdRef.current);
      frameIdRef.current = null;
    }
    bufferRef.current = "";
    lastFlushTimeRef.current = 0;
    lineBufferRef.current = "";
    setStreamingState({ isStreaming: false, streamingChatId: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flushBufferToStore]); // setStreamingState 是稳定的，不需要依赖

  const flushBuffer = useCallback(() => {
    const now = Date.now();
    const elapsed = now - lastFlushTimeRef.current;

    // 如果距离上次刷新时间太短，则跳过本次刷新
    if (elapsed < TYPEWRITER_INTERVAL_MS && bufferRef.current.length > 0) {
      scheduleFlush();
      return;
    }

    const buffer = bufferRef.current;
    if (!buffer) return;

    // 每次只取出配置数量的字符显示（打字机效果）
    const charsToShow = buffer.slice(0, TYPEWRITER_CHARS_PER_FRAME);
    bufferRef.current = buffer.slice(TYPEWRITER_CHARS_PER_FRAME);

    if (charsToShow) {
      lastFlushTimeRef.current = now;
      updateLastAssistantMessage(chatId, (last) => ({
        ...last,
        content: (last.content ?? "") + charsToShow,
      }));
    }

    // 如果缓冲区还有内容，继续安排下次刷新
    if (bufferRef.current.length > 0) {
      scheduleFlush();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]); // updateLastAssistantMessage 是稳定的，不需要依赖

  const scheduleFlush = useCallback(() => {
    if (frameIdRef.current) return;
    frameIdRef.current = requestAnimationFrame(() => {
      frameIdRef.current = null;
      flushBuffer();
    });
  }, [flushBuffer]);

  const startStream = useCallback(
    async (userContent) => {
      if (!chatId) return;
      stopStream();

      const now = Date.now();
      appendMessage(chatId, {
        id: `${now}-assistant`,
        role: "assistant",
        content: "",
        createdAt: now,
      });

      const controller = new AbortController();
      abortControllerRef.current = controller;
      bufferRef.current = "";
      lastFlushTimeRef.current = 0;
      setStreamingState({ isStreaming: true, streamingChatId: chatId });

      try {
        // eslint-disable-next-line no-console
        console.log("[前端] 开始请求流式接口，content:", userContent);
        const res = await fetch("/api/chat/stream", {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            // 这里可以注入 Auth Token，例如：
            // Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            chatId,
            // TODO: 如果你希望 LLM 有上下文，这里可以传当前会话历史 messages
            // 例如：messages: get().messagesBySession[chatId]
            messages: [],
            content: userContent,
          }),
        });

        // eslint-disable-next-line no-console
        console.log("[前端] 收到响应，status:", res.status, "ok:", res.ok);

        if (!res.ok || !res.body) {
          const errorText = await res.text().catch(() => "无法读取错误信息");
          // eslint-disable-next-line no-console
          console.error("[前端] HTTP 错误:", res.status, errorText);
          throw new Error(`HTTP error: ${res.status} - ${errorText}`);
        }

        const reader = res.body.getReader();
        const textDecoder = new TextDecoder();
        let totalChunks = 0;
        lineBufferRef.current = "";

        // 读取 SSE 流 data: {...}，用 lineBuffer 处理跨 chunk 的不完整行
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // eslint-disable-next-line no-console
            console.log("[前端] 流读取完成，共收到", totalChunks, "个数据块");
            break;
          }
          const chunkText = textDecoder.decode(value, { stream: true });
          lineBufferRef.current += chunkText;
          const allLines = lineBufferRef.current.split("\n");
          // 最后一段可能是不完整行，留到下次
          const incomplete = allLines.pop();
          lineBufferRef.current = incomplete ?? "";

          for (const line of allLines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload) continue;
            try {
              const json = JSON.parse(payload);
              // eslint-disable-next-line no-console
              console.log("[前端] 解析 JSON:", json);

              // 处理错误消息
              if (json.error) {
                // eslint-disable-next-line no-console
                console.error("[前端] 后端返回错误:", json.error);
                updateLastAssistantMessage(chatId, (last) => ({
                  ...last,
                  content: (last.content ?? "") + `\n\n[错误] ${json.error}`,
                }));
                break;
              }

              // 处理完成标记
              if (json.done) {
                // eslint-disable-next-line no-console
                console.log("[前端] 流式输出完成");
                break;
              }

              const delta = json.content ?? "";
              if (delta) {
                totalChunks++;
                bufferRef.current += delta;
                scheduleFlush();
              }
            } catch (parseErr) {
              // eslint-disable-next-line no-console
              console.warn(
                "[前端] JSON 解析失败:",
                parseErr,
                "payload:",
                payload,
              );
            }
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          // eslint-disable-next-line no-console
          console.error("[前端] SSE 错误:", err);
          // 显示错误消息给用户
          updateLastAssistantMessage(chatId, (last) => ({
            ...last,
            content: (last.content ?? "") + `\n\n[错误] ${err.message}`,
          }));
        }
      } finally {
        flushBuffer();
        stopStream();
      }
    },
    [
      appendMessage,
      chatId,
      flushBuffer,
      scheduleFlush,
      setStreamingState,
      stopStream,
    ],
  );

  // 当 chatId 变化或组件卸载时中断请求
  useEffect(() => {
    return () => {
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]); // 只依赖 chatId，stopStream 是稳定的

  return { startStream, stopStream };
}
