import { useRef, useState } from 'react'
import { useQuery } from 'deepspace'
import { Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui'

type Media = { gameId: string; kind: 'cover' | 'briefing'; status: 'pending' | 'ready' | 'failed'; path?: string }

// The optional cover and narrated briefing. Each appears only once it is ready
// and loads; while pending, failed, missing or broken, nothing is shown.
export function CaseExtras({ gameId }: { gameId: string }) {
  const media = useQuery<Media>('media', { where: { gameId } })
  const ready = (kind: Media['kind']) =>
    media.records.find((m) => m.data.kind === kind && m.data.status === 'ready' && m.data.path)?.data.path

  const cover = ready('cover')
  const briefing = ready('briefing')
  if (!cover && !briefing) return null

  return (
    <div className="mb-4 space-y-3">
      {cover && <Cover src={cover} />}
      {briefing && <BriefingButton src={briefing} />}
    </div>
  )
}

function Cover({ src }: { src: string }) {
  const [broken, setBroken] = useState(false)
  if (broken) return null
  return (
    <img
      src={src}
      alt="Cover illustration for this case"
      data-testid="case-cover"
      className="aspect-video w-full rounded-sm border border-border object-cover"
      onError={() => setBroken(true)}
    />
  )
}

function BriefingButton({ src }: { src: string }) {
  const audio = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [broken, setBroken] = useState(false)
  if (broken) return null

  function toggle() {
    const el = audio.current
    if (!el) return
    if (el.paused) el.play().catch(() => setBroken(true))
    else el.pause()
  }

  return (
    <div>
      <Button variant="outline" onClick={toggle} data-testid="case-briefing">
        {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
        {playing ? 'Pause briefing' : 'Play case briefing'}
      </Button>
      <audio
        ref={audio}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setBroken(true)}
      />
    </div>
  )
}
