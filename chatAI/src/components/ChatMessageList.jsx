import { useEffect, useMemo, useRef } from "react";
import { FixedSizeList as VirtualList } from "react-window";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

export function ChatMessageList({
  chatId,
  messages,
  scrollContainerRef,
  autoScroll,
  isStreamingForThisChat,
}) {
  const listRef = useRef(null);

  // 估算一条消息的大致高度（px），用于虚拟列表行高
  const itemHeight = 80;

  const itemData = useMemo(
    () => ({
      messages,
      isStreamingForThisChat,
    }),
    [messages, isStreamingForThisChat]
  );

  // 自动滚动到底部（依赖外层容器）
  useEffect(() => {
    if (!autoScroll) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    // 使用 requestAnimationFrame 确保 DOM 更新后再滚动
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [messages, autoScroll, scrollContainerRef]);

  if (messages.length === 0) {
    return (
      <div style={{ padding: "24px", textAlign: "center", color: "#6b7280" }}>
        还没有消息，开始对话吧！
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 24px", height: "100%", boxSizing: "border-box" }}>
      <VirtualList
        ref={listRef}
        height={scrollContainerRef.current?.clientHeight ?? 400}
        itemCount={messages.length}
        itemSize={itemHeight}
        width="100%"
        itemData={itemData}>
        {({ index, style, data }) => {
          const msg = data.messages[index];
          const isUser = msg.role === "user";
          const isLastMessage = index === data.messages.length - 1;
          const showLoading =
            isLastMessage &&
            !isUser &&
            data.isStreamingForThisChat &&
            !(msg.content ?? "").trim();

          return (
            <div
              style={style}
              className={isUser ? "msg-row user" : "msg-row assistant"}>
              <div className="msg-bubble">
                {showLoading ? (
                  <div className="chat-loading" aria-label="正在思考">
                    <span className="chat-loading-dot" />
                    <span className="chat-loading-dot" />
                    <span className="chat-loading-dot" />
                  </div>
                ) : (
                  <>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ inline, className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || "");
                          return !inline && match ? (
                            <SyntaxHighlighter
                              {...props}
                              style={oneDark}
                              language={match[1]}
                              PreTag="div">
                              {String(children).replace(/\n$/, "")}
                            </SyntaxHighlighter>
                          ) : (
                            <code className={className} {...props}>
                              {children}
                            </code>
                          );
                        },
                      }}>
                      {msg.content || ""}
                    </ReactMarkdown>
                    {isLastMessage &&
                      !isUser &&
                      data.isStreamingForThisChat &&
                      (msg.content ?? "").trim() && (
                        <span className="chat-typing-cursor" aria-hidden />
                      )}
                  </>
                )}
              </div>
            </div>
          );
        }}
      </VirtualList>
    </div>
  );
}
