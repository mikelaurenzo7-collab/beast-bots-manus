import Foundation

/// The moat: tools that only a native iOS app can expose to the agent.
///
/// Flow:
///   1. Boss server asks the iOS app (via the chat response or a silent push)
///      to run a device-tool by name.
///   2. iOS executes the tool locally against HealthKit / EventKit /
///      Contacts / Reminders / Shortcuts (each gated by user permission).
///   3. iOS posts the result back to `/v1/boss/device-tool-result` and the
///      server resumes the LLM loop.
///
/// A web-only or Android competitor CANNOT replicate the read side of
/// HealthKit, the system-wide Reminders DB, or the Shortcuts graph. That's
/// where the product defensibility lives.
///
/// Each tool below is a thin Swift wrapper; the heavy lifting is the
/// permission grant + async/await call. Everything stays on-device unless
/// the user explicitly opts in to sharing a summary back to the server.
protocol DeviceTool {
    var name: String { get }
    var label: String { get }
    var requiresPermission: String { get }
    func run(input: [String: Any]) async throws -> DeviceToolResult
}

struct DeviceToolResult: Encodable {
    let ok: Bool
    let summary: String
    let data: [String: AnyEncodable]?
    let error: String?
}

enum DeviceToolRegistry {
    /// Register all available on-device tools. Each tool gates its own
    /// permission prompt — we never pre-emptively ask at launch.
    static let all: [DeviceTool] = [
        // Sketched in DeviceTools+Calendar.swift, DeviceTools+Health.swift, etc.
        // Implemented incrementally as product priorities demand.
    ]

    static func lookup(_ name: String) -> DeviceTool? {
        all.first { $0.name == name }
    }
}

/// Type-erased Encodable wrapper so tools can return heterogeneous JSON.
struct AnyEncodable: Encodable {
    private let encodeFn: (Encoder) throws -> Void
    init<T: Encodable>(_ value: T) {
        self.encodeFn = value.encode
    }
    func encode(to encoder: Encoder) throws {
        try encodeFn(encoder)
    }
}
