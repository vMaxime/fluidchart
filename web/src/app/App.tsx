import { Route, Switch } from 'wouter'
import { AuthGate } from '../auth/AuthGate'
import { BoardList } from '../boards/BoardList'
import { BoardPage } from '../canvas/BoardPage'
import { SaveErrorBanner } from './SaveErrorBanner'

export function App() {
  return (
    <>
      <AuthGate>
        <Switch>
          <Route path="/b/:id">{(params) => <BoardPage id={params.id} />}</Route>
          <Route path="/">
            <BoardList />
          </Route>
        </Switch>
      </AuthGate>
      <SaveErrorBanner />
    </>
  )
}
