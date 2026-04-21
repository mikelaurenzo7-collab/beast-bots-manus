import Foundation

/// Mirrors the shapes returned by the Bot Boss REST API. All fields use the
/// server's camelCase, so no custom CodingKeys are needed.

struct User: Codable, Hashable, Identifiable {
    let id: Int
    let email: String?
    let name: String?
}

struct AuthResponse: Codable {
    let sessionToken: String
    let user: User
}

struct ChatMessage: Codable, Hashable, Identifiable {
    let id: Int
    let role: Role
    let content: String
    let runId: Int?
    let createdAt: Date

    enum Role: String, Codable { case user, assistant }
}

struct ChatHistoryResponse: Codable {
    let messages: [ChatMessage]
}

struct ToolCallSummary: Codable, Hashable, Identifiable {
    var id: String { "\(name)-\(summary)" }
    let name: String
    let label: String
    let ok: Bool
    let summary: String
    let durationMs: Int
}

struct RunResponse: Codable {
    let reply: String
    let toolCalls: [ToolCallSummary]
    let runId: Int
    let recipeName: String?
}

struct Run: Codable, Hashable, Identifiable {
    let id: Int
    let recipeId: Int?
    let status: Status
    let inputSummary: String?
    let outputSummary: String?
    let tokensUsed: Int?
    let durationMs: Int?
    let errorMessage: String?
    let toolCalls: [PersistedToolCall]?
    let createdAt: Date

    enum Status: String, Codable { case running, success, error }
}

struct PersistedToolCall: Codable, Hashable {
    let name: String
    let ok: Bool
    let summary: String
}

struct RunsResponse: Codable { let runs: [Run] }

struct Recipe: Codable, Hashable, Identifiable {
    let id: Int
    let name: String
    let prompt: String
    let tools: [String]
    let triggerKind: TriggerKind
    let triggerCron: String?
    let archived: Bool
    let createdAt: Date
    let updatedAt: Date

    enum TriggerKind: String, Codable { case manual, schedule, webhook }
}

struct RecipesResponse: Codable { let recipes: [Recipe] }
struct RecipeResponse: Codable { let recipe: Recipe }

struct Connection: Codable, Hashable, Identifiable {
    let id: Int
    let provider: String
    let accountName: String?
    let scopes: [String]?
    let expiresAt: Date?
    let createdAt: Date
}

struct ConnectionsResponse: Codable { let connections: [Connection] }

struct Note: Codable, Hashable, Identifiable {
    let id: Int
    let title: String
    let body: String
    let createdAt: Date
    let updatedAt: Date
}

struct NotesResponse: Codable { let notes: [Note] }
struct NoteResponse: Codable { let note: Note }

struct OKResponse: Codable { let ok: Bool }
