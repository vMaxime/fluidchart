import { useSyncExternalStore } from 'react'
import { hasSaveError, subscribeSaveError } from '../db/saveErrors'

export function SaveErrorBanner() {
  const failing = useSyncExternalStore(subscribeSaveError, hasSaveError)
  if (!failing) return null
  return (
    <div className="save-error" role="alert">
      Enregistrement impossible : vos dernières modifications ne sont pas sauvegardées. Ne fermez pas l'onglet.
    </div>
  )
}
