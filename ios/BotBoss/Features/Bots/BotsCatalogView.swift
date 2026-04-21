import SwiftUI

@MainActor
final class BotsCatalogViewModel: ObservableObject {
    @Published private(set) var bots: [BotSummary] = []
    @Published private(set) var connectedProviders: Set<String> = []
    @Published var errorMessage: String?

    func load() async {
        async let botsResp = try APIClient.shared.get("/v1/boss/catalog",
                                                      as: BotCatalogResponse.self)
        async let connsResp = try APIClient.shared.get("/v1/connections",
                                                       as: ConnectionsResponse.self)
        do {
            let (catalog, conns) = try await (botsResp, connsResp)
            self.bots = catalog.bots
            self.connectedProviders = Set(conns.connections.map(\.provider))
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func status(for bot: BotSummary) -> BotStatus {
        if bot.requiredProviders.isEmpty { return .ready }
        let missing = bot.requiredProviders.filter { !connectedProviders.contains($0) }
        return missing.isEmpty ? .ready : .needsConnection(missing)
    }
}

enum BotStatus: Equatable {
    case ready
    case needsConnection([String])
}

struct BotsCatalogView: View {
    @StateObject private var vm = BotsCatalogViewModel()

    private var grouped: [(category: String, bots: [BotSummary])] {
        let order = ["general", "ecommerce", "trading", "creator", "operator"]
        let groups = Dictionary(grouping: vm.bots, by: { $0.category })
        return order.compactMap { cat in
            guard let list = groups[cat], !list.isEmpty else { return nil }
            return (cat, list)
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: Theme.Spacing.xl, pinnedViews: [.sectionHeaders]) {
                    ForEach(grouped, id: \.category) { section in
                        Section {
                            LazyVGrid(
                                columns: [GridItem(.flexible()), GridItem(.flexible())],
                                spacing: Theme.Spacing.m
                            ) {
                                ForEach(section.bots) { bot in
                                    NavigationLink(value: bot) {
                                        BotCard(
                                            bot: bot,
                                            status: vm.status(for: bot)
                                        )
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.horizontal, Theme.Spacing.l)
                        } header: {
                            Text(sectionTitle(section.category))
                                .font(.title3.weight(.bold))
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.horizontal, Theme.Spacing.l)
                                .padding(.vertical, Theme.Spacing.s)
                                .background(Theme.background)
                        }
                    }
                }
                .padding(.vertical, Theme.Spacing.m)
            }
            .navigationTitle("Bots")
            .task { await vm.load() }
            .refreshable { await vm.load() }
            .navigationDestination(for: BotSummary.self) { bot in
                BotChatView(bot: bot)
            }
        }
    }

    private func sectionTitle(_ raw: String) -> String {
        switch raw {
        case "general": return "Generalist"
        case "ecommerce": return "Ecommerce"
        case "trading": return "Trading"
        case "creator": return "Creator"
        case "operator": return "Operator"
        default: return raw.capitalized
        }
    }
}

private struct BotCard: View {
    let bot: BotSummary
    let status: BotStatus

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s) {
            HStack {
                Image(systemName: bot.icon)
                    .font(.title2)
                    .foregroundStyle(Theme.accent)
                Spacer()
                statusBadge
            }
            Text(bot.name).font(.headline).foregroundStyle(Theme.textPrimary)
            Text(bot.tagline)
                .font(.caption)
                .foregroundStyle(Theme.textSecondary)
                .lineLimit(2)
        }
        .padding(Theme.Spacing.m)
        .frame(maxWidth: .infinity, minHeight: 120, alignment: .topLeading)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m))
    }

    @ViewBuilder
    private var statusBadge: some View {
        switch status {
        case .ready:
            Image(systemName: "checkmark.seal.fill")
                .foregroundStyle(.green)
                .font(.caption)
        case .needsConnection:
            Image(systemName: "link.badge.plus")
                .foregroundStyle(.orange)
                .font(.caption)
        }
    }
}
