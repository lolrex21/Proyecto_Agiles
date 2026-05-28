interface ToastProps {
  message: string
  type: 'info' | 'success'
  onClose: () => void
}

export default function Toast({ message, type, onClose }: ToastProps) {
  const bgClass = type === 'success'
    ? 'bg-green-600'
    : 'bg-blue-600'

  return (
    <div className={`fixed top-6 left-[50%] translate-x-[-50%] w-full max-w-[360px] z-[99999] p-4 rounded-lg shadow-2xl flex justify-between items-center text-white ${bgClass} animate-slide-down`}>
      <span className="text-sm font-semibold flex-1 mr-3">{message}</span>
      <button
        onClick={onClose}
        className="text-white/80 hover:text-white font-bold text-lg leading-none shrink-0"
      >
        ×
      </button>
    </div>
  )
}
