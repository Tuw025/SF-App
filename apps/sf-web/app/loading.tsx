export default function Loading() {
  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-blue-600 font-medium animate-pulse">Đang đồng bộ dữ liệu...</p>
      </div>
    </div>
  )
}
