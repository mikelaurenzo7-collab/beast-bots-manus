import StoreKit
import SwiftUI

/// Paywall sheet. Binds to `Subscriptions` (StoreKit 2) and lets the user
/// start or restore a subscription. No pricing strings are hard-coded —
/// `Product.displayPrice` localizes and includes introductory offers.
struct PaywallView: View {
    @EnvironmentObject private var subs: Subscriptions
    @Environment(\.dismiss) private var dismiss
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.l) {
                    header
                    valueProps
                    productCards
                    fineprint
                }
                .padding(Theme.Spacing.l)
            }
            .navigationTitle("Upgrade to Pro")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Restore") { Task { await subs.restore() } }
                }
            }
            .alert(
                "Purchase failed",
                isPresented: Binding(
                    get: { errorMessage != nil },
                    set: { _ in errorMessage = nil }
                ),
                actions: { Button("OK") {} },
                message: { Text(errorMessage ?? "") }
            )
            .task { await subs.loadProducts() }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            Image(systemName: "bolt.fill")
                .font(.system(size: 32))
                .foregroundStyle(Theme.accent)
            Text("Bot Boss Pro")
                .font(.title.weight(.bold))
            Text("Unlimited specialists. Scheduled recipes. Push alerts the moment something matters.")
                .font(.subheadline)
                .foregroundStyle(Theme.textSecondary)
        }
    }

    private var valueProps: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.m) {
            ValueProp(icon: "infinity", title: "2,500 runs / day", subtitle: "vs. 50 on Free")
            ValueProp(icon: "calendar.badge.clock", title: "Scheduled recipes", subtitle: "Daily digests, renewal sweeps, anything on cron")
            ValueProp(icon: "bell.badge", title: "Push alerts", subtitle: "Stockouts, new orders, Kalshi close — the moment they happen")
            ValueProp(icon: "link", title: "All OAuth connections", subtitle: "Shopify, Etsy, Pinterest, Kalshi")
        }
    }

    private var productCards: some View {
        VStack(spacing: Theme.Spacing.m) {
            if subs.products.isEmpty {
                ProgressView().frame(maxWidth: .infinity, minHeight: 120)
            } else {
                ForEach(subs.products, id: \.id) { product in
                    ProductCard(product: product, onTap: { purchase(product) })
                }
            }
        }
    }

    private var fineprint: some View {
        Text("Subscriptions auto-renew. Cancel any time in Settings → Apple ID → Subscriptions. No refunds for partial periods.")
            .font(.caption2)
            .foregroundStyle(Theme.textSecondary)
            .padding(.top, Theme.Spacing.s)
    }

    private func purchase(_ product: Product) {
        Task {
            do {
                let ok = try await subs.purchase(product)
                if ok { dismiss() }
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}

private struct ValueProp: View {
    let icon: String
    let title: String
    let subtitle: String

    var body: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.m) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(Theme.accent)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.body.weight(.semibold))
                Text(subtitle).font(.footnote).foregroundStyle(Theme.textSecondary)
            }
        }
    }
}

private struct ProductCard: View {
    let product: Product
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(product.displayName).font(.headline)
                    Text(product.description)
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                Text(product.displayPrice)
                    .font(.body.weight(.bold))
            }
            .padding(Theme.Spacing.m)
            .frame(maxWidth: .infinity)
            .background(Theme.surface)
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radius.m)
                    .stroke(Theme.accent, lineWidth: 1.5)
            )
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m))
        }
        .buttonStyle(.plain)
    }
}
