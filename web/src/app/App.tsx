import { Route, Switch } from 'wouter'
import { BoardList } from '../boards/BoardList'
import { BoardPage } from '../canvas/BoardPage'

export function App() {
  return (
    <Switch>
      <Route path="/b/:id">{(params) => <BoardPage id={params.id} />}</Route>
      <Route path="/"><BoardList /></Route>
    </Switch>
  )
}
