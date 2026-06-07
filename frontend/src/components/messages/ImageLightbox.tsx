import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

interface ImageLightboxProps {
  open: boolean
  imageUrl: string | null
  onOpenChange: (open: boolean) => void
}

/** Full-screen image preview overlay for chat message thumbnails. */
export default function ImageLightbox({ open, imageUrl, onOpenChange }: ImageLightboxProps) {
  if (!imageUrl) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-black/70 backdrop-blur-sm"
        className="max-w-none w-auto border-0 bg-transparent p-0 shadow-none outline-none"
      >
        <DialogTitle className="sr-only">View full image</DialogTitle>
        <img
          src={imageUrl}
          alt=""
          className="max-h-[90vh] max-w-[min(90vw,1200px)] object-contain"
        />
      </DialogContent>
    </Dialog>
  )
}
