import React from 'react'

const LABELS = {
  pending_acceptance: 'Pending',
  in_progress:        'In Progress',
  under_review:       'Ready for Review',
  approved:           'Completed',
  rejected:           'Rejected',
  completed:          'Completed',
  // Assignment statuses
  pending:   'Pending',
  accepted:  'Accepted',
  completed: 'Completed',
}

export default function StatusBadge({ status }) {
  const key = (status || '').toLowerCase().replace(/ /g, '_')
  return (
    <span className={`status-badge status-${key}`}>
      <span className="status-dot" />
      {LABELS[key] || status}
    </span>
  )
}
