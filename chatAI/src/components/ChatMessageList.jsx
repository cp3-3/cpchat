import { useEffect, useState } from "react";
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
  const [viewportHeight, setViewportHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  // 监听外层滚动容器，记录滚动位置和可视区域高度，用于虚拟列表计算
  useEffect(() => {
    const container = scrollContainerRef?.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    const handleResize = () => {
      setViewportHeight(container.clientHeight);
    };

    // 初始化一次高度
    handleResize();

    container.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleResize);

    return () => {
      container.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [scrollContainerRef]);

  // 自动滚动到底部
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

  // 当消息较多时启用虚拟列表，只渲染可视区附近的消息
  const shouldVirtualize = viewportHeight > 0 && messages.length > 50;

  const itemHeight = 80; // 预估每条消息高度（像素），用于计算可视范围
  const overscanCount = 5; // 上下各多渲染几条，减少滚动抖动

  let startIndex = 0;
  let endIndex = messages.length;
  let topPaddingHeight = 0;
  let bottomPaddingHeight = 0;

  if (shouldVirtualize) {
    const totalItems = messages.length;
    const visibleCount =
      Math.ceil(viewportHeight / itemHeight) + overscanCount * 2;

    startIndex = Math.max(
      0,
      Math.floor(scrollTop / itemHeight) - overscanCount
    );
    endIndex = Math.min(totalItems, startIndex + visibleCount);

    const totalHeight = totalItems * itemHeight;
    const renderedItems = endIndex - startIndex;

    topPaddingHeight = startIndex * itemHeight;
    bottomPaddingHeight =
      totalHeight - topPaddingHeight - renderedItems * itemHeight;
  }

  const visibleMessages = shouldVirtualize
    ? messages.slice(startIndex, endIndex)
    : messages;

  return (
    <div style={{ padding: "16px 24px" }}>
      {shouldVirtualize && topPaddingHeight > 0 ? (
        <div style={{ height: topPaddingHeight }} />
      ) : null}

      {visibleMessages.map((msg, i) => {
        const realIndex = shouldVirtualize ? startIndex + i : i;
        const isUser = msg.role === "user";
        const isLastMessage = realIndex === messages.length - 1;
        const showLoading =
          isLastMessage &&
          !isUser &&
          isStreamingForThisChat &&
          !(msg.content ?? "").trim();
        return (
          <div
            key={msg.id}
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
                    isStreamingForThisChat &&
                    (msg.content ?? "").trim() && (
                      <span className="chat-typing-cursor" aria-hidden />
                    )}
                </>
              )}
            </div>
          </div>
        );
      })}

      {shouldVirtualize && bottomPaddingHeight > 0 ? (
        <div style={{ height: bottomPaddingHeight }} />
      ) : null}
    </div>
  );
}
