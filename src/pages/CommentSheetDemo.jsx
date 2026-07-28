import { useState } from 'react'
import { ChevronLeft, X, Heart, MessageCircle, Send, Pin, Pencil, Trash2, CornerDownRight } from 'lucide-react'

// 커뮤니티 글 읽기+댓글 팝업 레이아웃 데모.
//   문제: 지금은 팝업 높이가 콘텐츠에 맡겨져 댓글이 늘수록 팝업이 계속 커짐.
//   해법 후보 2가지를 같은 콘텐츠로 비교 — 둘 다 높이 상한 + 내부 스크롤 + 입력창 하단 고정.
//     A안: 얇은 헤더바 고정(제목·작성자) + 본문·사진·댓글 스크롤 + 입력창 고정
//     B안: 입력창만 하단 고정 + 나머지(헤더·본문·사진·댓글) 전부 스크롤
//   /comment-sheet-demo

const COMMENTS = [
  { u: '운_영자', o: true, t: '오늘', c: '댓글' },
  { u: 'dkdkdkdkdk', o: false, t: '오늘', c: 'test' },
  { u: '운_영자', o: true, t: '오늘', c: 'ㅎㅎ' },
  { u: 'dkdkdkdkdk', o: false, t: '오늘', c: 'asdf' },
  { u: '운_영자', o: true, t: '오늘', c: 'ㅓ쳣' },
  { u: 'dkdkdkdkdk', o: false, t: '오늘', c: 'asdf' },
  { u: '김민준', o: false, t: '오늘', c: '오늘도 화이팅입니다 다들!' },
  { u: '이서연', o: false, t: '어제', c: '공지 확인했어요 감사합니다 🙌' },
  { u: '운_영자', o: true, t: '어제', c: '네 이번 주도 잘 부탁드려요' },
  { u: '박지후', o: false, t: '어제', c: 'ㅇㅋ' },
  { u: '최유나', o: false, t: '2일 전', c: '질문 있는데 여기 남겨도 되나요?' },
  { u: '운_영자', o: true, t: '2일 전', c: '그럼요! 편하게 남겨주세요' },
]

function Avatar({ owner }) {
  return owner
    ? <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-[13px] flex-shrink-0">🌞</div>
    : <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0">D</div>
}

// 글 본문 + 사진 + 좋아요/댓글 카운트 (스크롤 영역 상단에 들어가는 부분)
function PostBody() {
  return (
    <div className="px-5">
      <div className="flex items-start justify-between pt-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-base">🌞</div>
          <div>
            <p className="text-sm font-bold text-gray-800">운_영자</p>
            <p className="text-[11px] text-gray-400">오늘</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-gray-300">
          <Pin className="w-4 h-4" /><Pencil className="w-4 h-4" /><Trash2 className="w-4 h-4" />
        </div>
      </div>
      <h2 className="text-lg font-bold text-gray-900 mt-3">공지</h2>
      <p className="text-sm text-gray-600 mt-1 leading-relaxed">공지 내용입니다. 이번 주 미션 안내와 함께 참여 팁을 정리했어요.</p>
      {/* 사진 — 세로로 길 수 있는 첨부 이미지 시뮬레이션 */}
      <div className="mt-3 rounded-xl overflow-hidden bg-gradient-to-br from-emerald-200 to-teal-300 aspect-[4/3] flex items-center justify-center text-white/80 text-sm font-semibold">
        첨부 사진 (4:3)
      </div>
      <div className="flex items-center gap-4 py-3 mt-1 border-b border-gray-100">
        <span className="inline-flex items-center gap-1 text-sm text-gray-500"><Heart className="w-4 h-4" /> 1</span>
        <span className="inline-flex items-center gap-1 text-sm text-emerald-600"><MessageCircle className="w-4 h-4" /> {COMMENTS.length}</span>
      </div>
    </div>
  )
}

function CommentList() {
  return (
    <div className="px-5 py-2 space-y-3.5">
      {COMMENTS.map((c, i) => (
        <div key={i} className="flex items-start gap-2">
          <Avatar owner={c.o} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px]"><b className="font-bold text-gray-800">{c.u}</b> <span className="text-gray-400 text-[11px]">{c.t}</span></p>
            <p className="text-sm text-gray-700">{c.c}</p>
            <div className="flex items-center gap-3 mt-0.5 text-gray-400">
              <Heart className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold">답글</span>
            </div>
          </div>
          <Trash2 className="w-3.5 h-3.5 text-gray-300 mt-1" />
        </div>
      ))}
    </div>
  )
}

function Composer() {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 bg-white">
      <input
        placeholder="댓글 달기..."
        className="flex-1 min-w-0 h-10 px-3.5 rounded-full border border-gray-300 bg-gray-50 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-emerald-400 focus:bg-white transition"
      />
      <button className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0"><Send className="w-4 h-4" /></button>
    </div>
  )
}

function TopBar({ subtitle }) {
  return (
    <div className="flex-shrink-0 bg-white border-b border-gray-100">
      <div className="flex items-center justify-between px-4 h-12">
        <ChevronLeft className="w-5 h-5 text-gray-600" />
        <span className="text-[15px] font-bold text-gray-800">커뮤니티</span>
        <X className="w-5 h-5 text-gray-500" />
      </div>
      {/* 얇은 컨텍스트 줄 — 스크롤로 사진/본문이 사라져도 무슨 글인지 유지 (A안 전용) */}
      {subtitle && (
        <div className="flex items-center gap-1.5 px-4 pb-2 -mt-0.5">
          <span className="text-[12px]">🌞</span>
          <span className="text-[12px] font-semibold text-gray-500 truncate">운_영자 · <b className="text-gray-700">공지</b></span>
        </div>
      )}
    </div>
  )
}

// A안 — 얇은 헤더바 고정 + (본문·사진·댓글) 스크롤 + 입력창 고정
function VariantA() {
  return (
    <div className="h-full flex flex-col bg-white">
      <TopBar subtitle />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <PostBody />
        <CommentList />
      </div>
      <Composer />
    </div>
  )
}

// B안 — 입력창만 하단 고정, 나머지 전부 스크롤
function VariantB() {
  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 h-12 bg-white/95 backdrop-blur border-b border-gray-100">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
          <span className="text-[15px] font-bold text-gray-800">커뮤니티</span>
          <X className="w-5 h-5 text-gray-500" />
        </div>
        <PostBody />
        <CommentList />
      </div>
      <Composer />
    </div>
  )
}

export default function CommentSheetDemo() {
  const [tall, setTall] = useState(true)
  const frameH = tall ? 680 : 520
  return (
    <div className="min-h-screen bg-gray-100 p-5">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-xl font-bold text-gray-800">댓글 팝업 레이아웃 데모</h1>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">
          둘 다 <b>높이 상한 + 내부 스크롤 + 입력창 하단 고정</b>. 댓글이 많아도 팝업 크기는 그대로예요.<br />
          차이는 <b>상단</b>: A안은 얇은 헤더바(작성자·제목)를 고정해 스크롤해도 맥락 유지 / B안은 헤더까지 전부 스크롤(더 단순).
        </p>
        <label className="inline-flex items-center gap-2 mt-3 text-sm text-gray-600">
          <input type="checkbox" checked={tall} onChange={(e) => setTall(e.target.checked)} className="accent-emerald-500" />
          큰 화면 높이로 보기
        </label>

        <div className="grid md:grid-cols-2 gap-8 mt-5">
          {[['A안 — 얇은 헤더바 고정', <VariantA key="a" />], ['B안 — 입력창만 고정', <VariantB key="b" />]].map(([label, node]) => (
            <div key={label}>
              <p className="text-sm font-bold text-gray-700 mb-2">{label}</p>
              <div
                className="mx-auto w-full max-w-[380px] rounded-[28px] overflow-hidden shadow-2xl ring-8 ring-gray-800/90 bg-white"
                style={{ height: frameH }}
              >
                {node}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-6 leading-relaxed">
          ※ 스크롤 영역만 스크롤되는지, 입력창이 늘 하단에 보이는지 확인해 보세요. 마음에 드는 쪽 알려주시면 실제 팝업에 적용합니다.
        </p>
      </div>
    </div>
  )
}
