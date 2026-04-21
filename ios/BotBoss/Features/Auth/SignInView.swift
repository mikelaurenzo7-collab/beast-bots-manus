import AuthenticationServices
import SwiftUI
import UIKit

struct SignInView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var errorMessage: String?
    @State private var isWorking = false

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            VStack(spacing: Theme.Spacing.xl) {
                Spacer()

                VStack(spacing: Theme.Spacing.m) {
                    Image(systemName: "bolt.square.fill")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 72, height: 72)
                        .foregroundStyle(Theme.accent)
                    Text("Bot Boss")
                        .font(.system(size: 36, weight: .bold, design: .rounded))
                    Text("One agent. Plain-text recipes. Yours.")
                        .font(.subheadline)
                        .foregroundStyle(Theme.textSecondary)
                        .multilineTextAlignment(.center)
                }

                Spacer()

                SignInWithAppleButton(
                    onRequest: { req in
                        req.requestedScopes = [.fullName, .email]
                    },
                    onCompletion: handleResult
                )
                .signInWithAppleButtonStyle(.black)
                .frame(height: 52)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m))
                .disabled(isWorking)
                .padding(.horizontal, Theme.Spacing.xl)

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, Theme.Spacing.xl)
                }

                Text("By signing in you agree to the Terms and Privacy Policy.")
                    .font(.caption2)
                    .foregroundStyle(Theme.textSecondary)
                    .padding(.bottom, Theme.Spacing.l)
            }
            .padding(.horizontal, Theme.Spacing.l)
        }
    }

    private func handleResult(_ result: Result<ASAuthorization, Error>) {
        errorMessage = nil
        switch result {
        case .failure(let error):
            errorMessage = error.localizedDescription
        case .success(let auth):
            guard
                let credential = auth.credential as? ASAuthorizationAppleIDCredential,
                let tokenData = credential.identityToken,
                let token = String(data: tokenData, encoding: .utf8)
            else {
                errorMessage = "Apple did not return an identity token."
                return
            }

            isWorking = true
            Task {
                defer { Task { @MainActor in isWorking = false } }
                do {
                    let resp: AuthResponse = try await APIClient.shared.post(
                        "/v1/auth/apple",
                        body: AppleSignInBody(
                            identityToken: token,
                            fullName: credential.fullName.map {
                                AppleSignInBody.Name(
                                    givenName: $0.givenName,
                                    familyName: $0.familyName
                                )
                            },
                            email: credential.email
                        ),
                        requiresAuth: false
                    )
                    await MainActor.run {
                        session.signIn(token: resp.sessionToken, user: resp.user)
                    }
                    await MainActor.run {
                        UIApplication.shared.registerForRemoteNotifications()
                    }
                } catch {
                    await MainActor.run { errorMessage = error.localizedDescription }
                }
            }
        }
    }
}

private struct AppleSignInBody: Encodable {
    struct Name: Encodable {
        let givenName: String?
        let familyName: String?
    }
    let identityToken: String
    let fullName: Name?
    let email: String?
}
