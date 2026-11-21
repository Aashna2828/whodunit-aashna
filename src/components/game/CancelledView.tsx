import { Link } from 'react-router-dom'
import { CaseCard } from '@/components/common/CaseCard'

export function CancelledView() {
  return (
    <CaseCard label="Case withdrawn" testId="cancelled">
      <p>The host cancelled this game before the investigation began.</p>
      <Link to="/home" className="mt-3 inline-block text-primary underline-offset-4 hover:underline">
        Back to your cases
      </Link>
    </CaseCard>
  )
}
