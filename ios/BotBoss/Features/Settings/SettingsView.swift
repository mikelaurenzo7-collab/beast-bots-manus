import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var showSignOutConfirm = false

    var body: some View {
        NavigationStack {
            List {
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
