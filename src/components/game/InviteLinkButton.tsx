import { Link2 } from 'lucide-react'
import { Button, useToast } from '@/components/ui'

// Copies this page's URL; whoever opens it lands on the lobby with a Join button.
export function InviteLinkButton() {
  const { success, error } = useToast()

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      success('Invite link copied', 'Send it to 1 to 3 friends.')
    } catch {
      error('Could not copy', `Copy this address instead: ${window.location.href}`)
    }
  }

  return (
    <Button variant="outline" onClick={copy}>
      <Link2 className="size-4" aria-hidden /> Copy invite link
    </Button>
  )
}
