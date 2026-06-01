/** CDN 預覽（與 LINE 使用者貼圖預覽相同）；部分動態貼圖可能無靜態圖。 */
export function lineStickerPreviewUrl(stickerId: string): string {
  return `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/IOS/sticker.png`
}

/**
 * LINE Messaging API 官方 sticker list 常見套餐之一（11537）。
 * 編號來自 LINE Developers「Sticker list」文件；若預覽 404 仍以 push 是否成功為準。
 */
export const LINE_PRESET_STICKERS: {
  label: string
  packageId: string
  stickerId: string
}[] = [
  { label: '哈囉', packageId: '11537', stickerId: '52002734' },
  { label: 'OK', packageId: '11537', stickerId: '52002735' },
  { label: '謝謝', packageId: '11537', stickerId: '52002736' },
  { label: '早安', packageId: '11537', stickerId: '52002737' },
  { label: '晚安', packageId: '11537', stickerId: '52002738' },
  { label: '抱歉', packageId: '11537', stickerId: '52002739' },
  { label: '加油', packageId: '11537', stickerId: '52002740' },
  { label: '掰掰', packageId: '11537', stickerId: '52002741' },
]
