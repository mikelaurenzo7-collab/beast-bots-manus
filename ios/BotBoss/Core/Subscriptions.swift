import Foundation
import StoreKit

/// StoreKit 2 subscription manager.
///
/// Responsibilities:
///   1. Load the two Pro products from the App Store.
///   2. Initiate a purchase; on success, POST the transaction id to the
///      backend so we can verify with the App Store Server API.
///   3. Listen for transaction updates (renewals, refunds, cross-device
///      restores) and keep the server state current.
///   4. Expose `isPro` + `activeProductId` for the UI to bind against.
///
/// The backend is the source of truth for "is this user Pro right now?" —
/// `isPro` is local convenience only. We always re-check the server after
/// any transaction event.
@MainActor
final class Subscriptions: ObservableObject {
    enum ProductId: String, CaseIterable {
        case monthly = "com.botboss.pro.monthly"
        case yearly = "com.botboss.pro.yearly"
    }

    @Published private(set) var products: [Product] = []
    @Published private(set) var activeProductId: String?
    @Published private(set) var expiresAt: Date?
    @Published private(set) var isPurchasing = false

    private var updatesTask: Task<Void, Never>?

    init() {
        updatesTask = Task { [weak self] in await self?.listenForUpdates() }
        Task { await loadProducts(); await refreshEntitlements() }
    }

    deinit { updatesTask?.cancel() }

    var isPro: Bool { activeProductId != nil }

    // MARK: - Product catalog

    func loadProducts() async {
        do {
            let ids = ProductId.allCases.map(\.rawValue)
            let loaded = try await Product.products(for: ids)
            // Deterministic ordering: monthly first, yearly second.
            self.products = loaded.sorted { lhs, rhs in
                (lhs.id == ProductId.monthly.rawValue) && (rhs.id != ProductId.monthly.rawValue)
            }
        } catch {
            print("StoreKit products load failed:", error.localizedDescription)
        }
    }

    // MARK: - Purchase

    @discardableResult
    func purchase(_ product: Product) async throws -> Bool {
        isPurchasing = true
        defer { isPurchasing = false }

        let result = try await product.purchase()
        switch result {
        case .success(let verification):
            let tx = try checkVerified(verification)
            await verifyWithBackend(tx)
            await tx.finish()
            await refreshEntitlements()
            return true
        case .userCancelled:
            return false
        case .pending:
            // Awaiting SCA / parental approval — treat as deferred.
            return false
        @unknown default:
            return false
        }
    }

    func restore() async {
        try? await AppStore.sync()
        await refreshEntitlements()
    }

    // MARK: - Entitlement snapshot

    func refreshEntitlements() async {
        var activeId: String?
        var activeExpiry: Date?
        for await result in Transaction.currentEntitlements {
            guard case .verified(let tx) = result else { continue }
            if ProductId(rawValue: tx.productID) != nil {
                activeId = tx.productID
                activeExpiry = tx.expirationDate
                await verifyWithBackend(tx)
            }
        }
        self.activeProductId = activeId
        self.expiresAt = activeExpiry
    }

    // MARK: - Backend verification

    /// Tell the server about this transaction so our `subscriptions` table
    /// records the user as Pro. Auth is via the session bearer already
    /// stored in Keychain; silent no-op if the user isn't signed in.
    private func verifyWithBackend(_ tx: Transaction) async {
        guard Keychain.get(.sessionToken) != nil else { return }
        struct Body: Encodable {
            let transactionId: String
            let sandbox: Bool
        }
        struct Response: Decodable {
            let plan: String
            let productId: String?
            let expiresAt: String?
        }
        do {
            let _: Response = try await APIClient.shared.post(
                "/v1/billing/apple/verify",
                body: Body(
                    transactionId: String(tx.id),
                    sandbox: tx.environment == .sandbox
                )
            )
        } catch {
            print("apple verify failed:", error.localizedDescription)
        }
    }

    // MARK: - Background transaction listener

    private func listenForUpdates() async {
        for await result in Transaction.updates {
            guard case .verified(let tx) = result else { continue }
            await verifyWithBackend(tx)
            await tx.finish()
            await refreshEntitlements()
        }
    }

    // MARK: -

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .verified(let value): return value
        case .unverified(_, let error): throw error
        }
    }
}
