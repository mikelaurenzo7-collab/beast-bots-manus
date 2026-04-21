import SwiftUI

@MainActor
final class ConnectionsViewModel: ObservableObject {
    @Published private(set) var connections: [Connection] = []
    @Published var errorMessage: String?

    func load() async {
        do {
            let resp: ConnectionsResponse = try await APIClient.shared.get("/v1/connections")
            self.connections = resp.connections
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func disconnect(_ provider: String) async {
        do {
            let _: OKResponse = try await APIClient.shared.delete("/v1/connections/\(provider)")
            self.connections.removeAll { $0.provider == provider }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct ConnectionsView: View {
    @StateObject private var vm = ConnectionsViewModel()

    var body: some View {
        List {
            Section {
                if vm.connections.isEmpty {
                    Text("No connections yet.")
                        .foregroundStyle(Theme.textSecondary)
                } else {
                    ForEach(vm.connections) { connection in
                        HStack {
                            VStack(alignment: .leading) {
                                Text(connection.provider.capitalized).font(.headline)
                                if let name = connection.accountName {
                                    Text(name).font(.footnote).foregroundStyle(Theme.textSecondary)
                                }
                            }
                            Spacer()
                            Button("Disconnect", role: .destructive) {
                                Task { await vm.disconnect(connection.provider) }
                            }
                            .buttonStyle(.bordered)
                            .tint(.red)
                        }
                    }
                }
            } header: {
                Text("Connected accounts")
            } footer: {
                Text("Bot Boss stores OAuth tokens encrypted with AES-256-GCM. Disconnect any time; disconnecting revokes the stored token from our servers.")
            }

            Section("Available providers") {
                Text("Bring-your-own-token OAuth connections will appear here in a future update. For now, Bot Boss ships with its built-in tools only.")
                    .font(.footnote)
                    .foregroundStyle(Theme.textSecondary)
            }
        }
        .navigationTitle("Connections")
        .task { await vm.load() }
    }
}
