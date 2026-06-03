// 약관/정책 문서 공통 wrapper — 표 양식·시행일 표기·섹션 헤더 통일.
// PrivacyPolicyPage / TermsOfServicePage 공유.

export function LegalPageShell({ title, effectiveDate, version, children }) {
  return (
    <article className="mt-2 bg-white border border-gray-100 rounded-card-lg shadow-soft p-6">
      <header className="mb-5 pb-4 border-b border-gray-100">
        <h1 className="text-xl font-bold text-gray-800">{title}</h1>
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
          {effectiveDate && <span>시행일: {effectiveDate}</span>}
          {version && <span>· {version}</span>}
        </div>
      </header>
      <div className="text-sm text-gray-700 space-y-1 leading-relaxed">
        {children}
      </div>
    </article>
  )
}

export function Section({ title, children }) {
  return (
    <section className="mt-5">
      <h2 className="text-base font-semibold text-gray-800 mb-2">{title}</h2>
      <div className="text-sm text-gray-600 leading-relaxed space-y-1.5">
        {children}
      </div>
    </section>
  )
}

export function Sub({ children }) {
  return <ul className="list-disc list-inside space-y-1 pl-2 text-sm text-gray-600">{children}</ul>
}
