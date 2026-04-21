import Foundation

@MainActor
final class ChatViewModel: ObservableObject {
    @Published private(set) var messages: [ChatMessage] = []
    @Published private(set) var toolCallsByRunId: [Int: [ToolCallSummary]] = [:]
    @Published private(set) var isSending = false
    @Published var errorMessage: String?

    func loadHistory() async {
        do {
            let resp: ChatHistoryResponse = try await APIClient.shared.get("/v1/boss/chat")
            // Server returns newest-first; reverse so list reads top-to-bottom oldest-to-newest.
            self.messages = resp.messages.sorted(by: { $0.id < $1.id })
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func send(_ text: String, recipeId: Int? = nil, useHistory: Bool = true) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        // Optimistic user message so the UI updates immediately.
        let optimistic = ChatMessage(
            id: -Int(Date().timeIntervalSince1970 * 1000),
            role: .user,
            content: trimmed,
            runId: nil,
            createdAt: Date()
        )
        messages.append(optimistic)

        isSending = true
        defer { isSending = false }

        struct Body: Encodable {
            let message: String
            let recipeId: Int?
            let useHistory: Bool
        }

        do {
            let resp: RunResponse = try await APIClient.shared.post(
                "/v1/boss/run",
                body: Body(message: trimmed, recipeId: recipeId, useHistory: useHistory)
            )
            let assistant = ChatMessage(
                id: resp.runId,
                role: .assistant,
                content: resp.reply,
                runId: resp.runId,
                createdAt: Date()
            )
            messages.append(assistant)
            toolCallsByRunId[resp.runId] = resp.toolCalls
        } catch {
            errorMessage = error.localizedDescription
            // Pop the optimistic message so the user isn't confused.
            if messages.last?.id == optimistic.id { messages.removeLast() }
        }
    }

    func clear() async {
        messages.removeAll()
        toolCallsByRunId.removeAll()
    }
}
