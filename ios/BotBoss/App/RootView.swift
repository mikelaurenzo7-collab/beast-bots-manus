import SwiftUI

struct RootView: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        Group {
            if session.isSignedIn {
                MainTabView()
            } else {
                SignInView()
            }
        }
        .animation(.easeInOut(duration: 0.25), value: session.isSignedIn)
    }
}

struct MainTabView: View {
    var body: some View {
        TabView {
            BotsCatalogView()
                .tabItem { Label("Bots", systemImage: "square.grid.2x2.fill") }

            RecipesView()
                .tabItem { Label("Recipes", systemImage: "list.bullet.rectangle") }

            HistoryView()
                .tabItem { Label("Activity", systemImage: "clock.arrow.circlepath") }

            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
        }
    }
}
