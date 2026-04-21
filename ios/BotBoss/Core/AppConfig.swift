import Foundation

/// Reads the API base URL from Info.plist (`BotBossAPIBaseURL`) so the same
/// binary can point at staging vs. production by swapping `.xcconfig` values.
enum AppConfig {
    static let apiBaseURL: URL = {
        let fallback = URL(string: "https://api.botboss.app")!
        guard
            let raw = Bundle.main.object(forInfoDictionaryKey: "BotBossAPIBaseURL") as? String,
            let url = URL(string: raw)
        else { return fallback }
        return url
    }()
}
