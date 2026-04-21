import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var subs: Subscriptions
    @State private var showSignOutConfirm = false
    @State private var showPaywall = false

    var body: some View {
        NavigationStack {
            List {
                Section("Plan") {
                    if subs.isPro {
                        HStack {
                            Image(systemName: "bolt.fill").foregroundStyle(Theme.accent)
                            VStack(alignment: .leading) {
                                Text("Bot Boss Pro").font(.headline)
                                if let expiry = subs.expiresAt {
                                    Text("Renews \(expiry.formatted(date: .abbreviated, time: .omitted))")
                                        .font(.caption).foregroundStyle(Theme.textSecondary)
                                }
                            }
                        }
                        Button("Manage subscription") {
                            if let url = URL(string: "itms-apps://apps.apple.com/account/subscriptions") {
                                UIApplication.shared.open(url)
                            }
                        }
                    } else {
                        Button {
                            showPaywall = true
                        } label: {
                            HStack {
                                Image(systemName: "bolt.fill").foregroundStyle(Theme.accent)
                                VStack(alignment: .leading) {
                                    Text("Upgrade to Pro").font(.headline)
                                    Text("2,500 runs/day, scheduled recipes, push alerts")
                                        .font(.caption).foregroundStyle(Theme.textSecondary)
                                }
                                Spacer()
                                Image(systemName: "chevron.right").foregroundStyle(Theme.textSecondary)
                            }
                        }
                        Button("Restore purchases") {
                            Task { await subs.restore() }
                        }
                    }
                }

                Section("Account") {
                    if let user = session.currentUser {
                        if let name = user.name {
                            LabeledContent("Name", value: name)
                        }
                        if let email = user.email {
                            LabeledContent("Email", value: email)
                        }
                        LabeledContent("User ID", value: "#\(user.id)")
                    }
                    Button("Sign out", role: .destructive) {
                        showSignOutConfirm = true
                    }
                }

                Section("Integrations") {
                    NavigationLink("Connections") { ConnectionsView() }
                    NavigationLink("Notes") { NotesView() }
                }

                Section("About") {
                    LabeledContent("Version", value: Bundle.main.shortVersion)
                    Link("Privacy Policy", destination: URL(string: "https://botboss.app/privacy")!)
                    Link("Terms of Service", destination: URL(string: "https://botboss.app/terms")!)
                    Link("Support", destination: URL(string: "mailto:support@botboss.app")!)
                }
            }
            .navigationTitle("Settings")
            .confirmationDialog("Sign out of Bot Boss?",
                                isPresented: $showSignOutConfirm,
                                titleVisibility: .visible) {
                Button("Sign out", role: .destructive) { session.signOut() }
                Button("Cancel", role: .cancel) {}
            }
            .sheet(isPresented: $showPaywall) {
                PaywallView().environmentObject(subs)
            }
        }
    }
}

private extension Bundle {
    var shortVersion: String {
        let v = infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
        let b = infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(v) (\(b))"
    }
}
