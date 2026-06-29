/** สีมาตรฐานสำหรับข้อมูลเวลา: เริ่ม=เขียว สิ้นสุด=แดง ใช้เวลา=ฟ้า */
export const timerTimeTheme = {
  start: {
    label: "text-green-700",
    value: "text-green-800",
    box: "bg-green-50 border border-green-200",
    boxActive: "bg-green-100 ring-2 ring-green-600 border-green-300",
    cell: "bg-green-50/60",
  },
  end: {
    label: "text-red-700",
    value: "text-red-800",
    box: "bg-red-50 border border-red-200",
    boxActive: "bg-red-100 ring-2 ring-red-600 border-red-300",
    cell: "bg-red-50/60",
  },
  duration: {
    label: "text-blue-700",
    value: "text-blue-800",
    box: "bg-blue-50 border border-blue-200",
    boxActive: "bg-blue-100 ring-2 ring-blue-600 border-blue-300",
    cell: "bg-blue-50/60",
  },
} as const
