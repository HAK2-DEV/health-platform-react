import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// 공용 마크다운 렌더러 — OverviewEditModal 미리보기 / ProgramDetailPage 개요 탭 공유.
// Tailwind Typography(prose) 미사용 — 컴포넌트별 className 직접 지정으로 본 프로젝트 톤 일관.
// GFM(GitHub Flavored Markdown) 지원: 체크박스, 표, 취소선, 자동 링크.
function MarkdownView({ content, className = '' }) {
  if (!content || !content.trim()) return null

  return (
    <article className={`text-sm text-gray-700 leading-relaxed break-words ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => <h1 className="text-xl font-bold text-gray-800 mt-4 mb-2 first:mt-0" {...props} />,
          h2: ({ node, ...props }) => <h2 className="text-lg font-semibold text-gray-800 mt-3 mb-2 first:mt-0" {...props} />,
          h3: ({ node, ...props }) => <h3 className="text-base font-semibold text-gray-800 mt-2 mb-1 first:mt-0" {...props} />,
          p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
          a: ({ node, ...props }) => (
            <a className="text-emerald-600 underline underline-offset-2 hover:text-emerald-700" target="_blank" rel="noopener noreferrer" {...props} />
          ),
          ul: ({ node, ordered, ...props }) => <ul className="list-disc pl-5 mb-2 space-y-0.5" {...props} />,
          ol: ({ node, ordered, ...props }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5" {...props} />,
          li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
          strong: ({ node, ...props }) => <strong className="font-semibold text-gray-900" {...props} />,
          em: ({ node, ...props }) => <em className="italic" {...props} />,
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-emerald-200 pl-3 my-2 text-gray-600 italic" {...props} />
          ),
          code: ({ node, inline, className: codeCls, ...props }) =>
            inline ? (
              <code className="px-1 py-0.5 bg-gray-100 rounded text-xs font-mono text-gray-800" {...props} />
            ) : (
              <code className="block p-2 my-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono text-gray-800 whitespace-pre-wrap overflow-x-auto" {...props} />
            ),
          hr: () => <hr className="border-t border-gray-200 my-3" />,
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full border border-gray-200 text-xs" {...props} />
            </div>
          ),
          th: ({ node, ...props }) => <th className="border border-gray-200 bg-gray-50 px-2 py-1 font-semibold text-left" {...props} />,
          td: ({ node, ...props }) => <td className="border border-gray-200 px-2 py-1" {...props} />,
          // 체크박스 — GFM task list. 클릭은 disabled (편집은 모달에서)
          input: ({ node, ...props }) => (
            <input className="mr-1 accent-emerald-500 align-middle" disabled {...props} />
          ),
          img: ({ node, ...props }) => <img className="max-w-full rounded-lg my-2" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  )
}

export default MarkdownView
