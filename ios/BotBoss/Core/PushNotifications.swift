import Foundation
import UIKit
import UserNotifications

/// APNs registration + device-token round-tripping to the backend.
enum PushNotifications {
    static func requestAuthorizationIfNeeded() {
        let center = UNUserNotificationCenter.current()
        center.getNotificationSettings { settings in
            guard settings.authorizationStatus == .notDetermined else {
                if settings.authorizationStatus == .authorized {
                    DispatchQueue.main.async { UIApplication.shared.registerForRemoteNotifications() }
                }
                return
            }
            center.requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
                guard granted else { return }
                DispatchQueue.main.async { UIApplication.shared.registerForRemoteNotifications() }
            }
        }
    }

    static func register(deviceToken: String) async {
        guard Keychain.get(.sessionToken) != nil else { return }
        struct Body: Encodable {
            let deviceToken: String
            let environment: String
        }
        #if DEBUG
        let env = "sandbox"
        #else
        let env = "production"
        #endif
        do {
            let _: EmptyResponse = try await APIClient.shared.post(
                "/v1/devices",
                body: Body(deviceToken: deviceToken, environment: env)
            )
        } catch {
            print("Failed to register device token:", error.localizedDescription)
        }
    }

    struct EmptyResponse: Decodable { let ok: Bool? }
}
