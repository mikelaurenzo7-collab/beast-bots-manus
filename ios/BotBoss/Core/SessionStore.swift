import Foundation
import SwiftUI

/// Holds the signed-in user and the bearer token state. The token itself
/// lives in Keychain; we only cache `isSignedIn` for UI reactivity.
@MainActor
final class SessionStore: ObservableObject {
    @Published private(set) var isSignedIn: Bool
    @Published private(set) var currentUser: User?

    init() {
        let hasToken = Keychain.get(.sessionToken) != nil
        self.isSignedIn = hasToken
        if hasToken, let idString = Keychain.get(.userId), let id = Int(idString) {
            self.currentUser = User(id: id, email: nil, name: nil)
        }
    }

    func signIn(token: String, user: User) {
        Keychain.set(token, for: .sessionToken)
        Keychain.set(String(user.id), for: .userId)
        self.currentUser = user
        self.isSignedIn = true
    }

    func signOut() {
        Keychain.remove(.sessionToken)
        Keychain.remove(.userId)
        self.currentUser = nil
        self.isSignedIn = false
    }
}
