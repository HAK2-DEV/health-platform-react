import { Check, X, Loader2 } from 'lucide-react'
import { useNicknameCheck } from '../../hooks/useNicknameCheck'
import { NICKNAME } from '../../lib/constants'

function NicknameInput({ value, onChange, currentUserId = null }) {
  const status = useNicknameCheck(value, currentUserId)
  
  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        닉네임 ({NICKNAME.MIN_LENGTH}-{NICKNAME.MAX_LENGTH}자)
      </label>
      
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={NICKNAME.MAX_LENGTH}
          placeholder="닉네임을 입력하세요"
          className="w-full px-3 py-2 pr-10 text-base border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500"
        />
        
        {/* 상태 아이콘 */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {status.checking && (
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          )}
          {!status.checking && status.available === true && (
            <Check className="w-5 h-5 text-emerald-500" />
          )}
          {!status.checking && status.available === false && (
            <X className="w-5 h-5 text-red-500" />
          )}
        </div>
      </div>
      
      {/* 상태 메시지 */}
      {!status.checking && status.available === true && (
        <p className="mt-1 text-sm text-emerald-600">
          사용 가능한 닉네임입니다
        </p>
      )}
      {!status.checking && status.available === false && status.reason && (
        <p className="mt-1 text-sm text-red-600">
          {status.reason}
        </p>
      )}
      {!status.checking && status.available === null && value && (
        <p className="mt-1 text-sm text-gray-500">
          입력 중...
        </p>
      )}
      
      {/* 도움말 */}
      <p className="mt-1 text-xs text-gray-500">
        한글, 영문, 숫자, _ - . 사용 가능
      </p>
    </div>
  )
}

export default NicknameInput