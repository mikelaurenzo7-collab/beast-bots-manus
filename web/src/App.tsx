import { Link, Route, Switch, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "./components/Sidebar";
import { SignInPage } from "./pages/SignIn";
import { BotsPage } from "./pages/Bots";
import { BotChatPage } from "./pages/BotChat";
import { RecipesPage } from "./pages/Recipes";
import { HistoryPage } from "./pages/History";
import { ConnectionsPage } from "./pages/Connections";
import { SettingsPage } from "./pages/Settings";
import { getSessionToken } from "./lib/api";

export function App() {
  const token = getSessionToken();
  if (!token) return <SignInPage />;

  return (
    <div className="app">
      <Sidebar />
      <main>
        <Switch>
          <Route path="/" component={BotsPage} />
          <Route path="/bots" component={BotsPage} />
          <Route path="/bots/:slug">{(params) => <BotChatPage slug={params.slug} />}</Route>
          <Route path="/recipes" component={RecipesPage} />
          <Route path="/history" component={HistoryPage} />
          <Route path="/connections" component={ConnectionsPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route>
            <NotFound />
          </Route>
        </Switch>
      </main>
    </div>
  );
}

function NotFound() {
  const [, setLocation] = useLocation();
  return (
    <div className="page">
      <h1>Not found</h1>
      <button className="btn" onClick={() => setLocation("/")}>
        Back to bots
      </button>
    </div>
  );
}
