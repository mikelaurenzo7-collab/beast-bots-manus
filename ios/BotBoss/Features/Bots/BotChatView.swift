import SwiftUI

@MainActor
final class BotChatViewModel: ObservableObject {
    @Published private(set) var messages: [ChatMessage] = []
    @Published private(set) var toolCallsByRunId: [Int: [ToolCallSummary]] = [:]
    @Published private(set) var isSending = false
    @Published var errorMessage: String?

    let botSlug: String

    init(botSlug: String) {
        self.botSlug = botSlug
    }

    func loadHistory() async {
        do {
            let resp: ChatHistoryResponse = try await APIClient.shared.get(
                "/v1/boss/chat",
                query: ["botSlug": botSlug]
            )
            self.messages = resp.messages.sorted(by: { $0.id < $1.id })
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func send(_ text: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

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
            let botSlug: String
            let message: String
            let useHistory: Bool
        }

        do {
            let resp: RunResponse = try await APIClient.shared.post(
                "/v1/boss/run",
                body: Body(botSlug: botSlug, message: trimmed, useHistory: true)
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
            if messages.last?.id == optimistic.id { messages.removeLast() }
        }
    }
}

struct BotChatView: View {
    let bot: BotSummary

    @StateObject private var vm: BotChatViewModel
    @State private var draft = ""
    @FocusState private var inputFocused: Bool

    init(bot: BotSummary) {
        self.bot = bot
        _vm = StateObject(wrappedValue: BotChatViewModel(botSlug: bot.slug))
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: Theme.Spacing.l) {
                        if vm.messages.isEmpty {
                            Empty(bot: bot).padding(.top, Theme.Spacing.xl * 2)
                        } else {
                            ForEach(vm.messages) { msg in
                                MessageRow(
                                    message: msg,
                                    toolCalls: msg.runId.flatMap { vm.toolCallsByRunId[$0] } ?? []
                                )
                                .id(msg.id)
                            }
                        }
                        if vm.isSending { TypingIndicator().id("typing") }
                    }
                    .padding(.horizontal, Theme.Spacing.l)
                    .padding(.vertical, Theme.Spacing.m)
                }
                .onChange(of: vm.messages.count) { _, _ in
                    if let last = vm.messages.last {
                        withAnimation(.easeOut(duration: 0.2)) {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                }
            }
            Composer(
                draft: $draft,
                isSending: vm.isSending,
                isFocused: $inputFocused
            ) {
                let text = draft; draft = ""
                Task { await vm.send(text) }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .task { await vm.loadHistory() }
        .alert(
            "Something went wrong",
            isPresented: Binding(
                get: { vm.errorMessage != nil },
                set: { _ in vm.errorMessage = nil }
            ),
            actions: { Button("OK") {} },
            message: { Text(vm.errorMessage ?? "") }
        )
    }

    private var header: some View {
        HStack(spacing: Theme.Spacing.m) {
            Image(systemName: bot.icon)
                .font(.title2)
                .foregroundStyle(Theme.accent)
            VStack(alignment: .leading) {
                Text(bot.name).font(.headline)
                Text(bot.tagline).font(.caption).foregroundStyle(Theme.textSecondary)
            }
            Spacer()
        }
        .padding(.horizontal, Theme.Spacing.l)
        .padding(.vertical, Theme.Spacing.s)
        .background(Theme.surface)
    }
}

private struct Empty: View {
    let bot: BotSummary
    var body: some View {
        VStack(spacing: Theme.Spacing.m) {
            Image(systemName: bot.icon)
                .font(.system(size: 48))
                .foregroundStyle(Theme.accent)
            Text("Hi, I'm the \(bot.name).")
                .font(.title3.weight(.semibold))
            Text(bot.revenueProposition)
                .font(.footnote)
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Theme.Spacing.xl)
        }
        .frame(maxWidth: .infinity)
    }
}

private struct MessageRow: View {
    let message: ChatMessage
    let toolCalls: [ToolCallSummary]

    var body: some View {
        VStack(alignment: message.role == .user ? .trailing : .leading, spacing: Theme.Spacing.xs) {
            HStack {
                if message.role == .user { Spacer(minLength: 40) }
                Text(message.content)
                    .font(.body)
                    .padding(.horizontal, Theme.Spacing.m)
                    .padding(.vertical, Theme.Spacing.s)
                    .background(message.role == .user ? Theme.accent : Theme.surface)
                    .foregroundStyle(message.role == .user ? .white : Theme.textPrimary)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m))
                if message.role == .assistant { Spacer(minLength: 40) }
            }
            if !toolCalls.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Theme.Spacing.s) {
                        ForEach(toolCalls) { call in
                            HStack(spacing: Theme.Spacing.xs) {
                                Image(systemName: call.ok
                                      ? "checkmark.circle.fill"
                                      : "xmark.octagon.fill")
                                    .foregroundStyle(call.ok ? .green : .red)
                                Text(call.label).font(.caption.weight(.medium))
                            }
                            .padding(.horizontal, Theme.Spacing.s)
                            .padding(.vertical, Theme.Spacing.xs)
                            .background(Theme.surface)
                            .clipShape(Capsule())
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: message.role == .user ? .trailing : .leading)
    }
}

private struct TypingIndicator: View {
    @State private var tick = false
    var body: some View {
        HStack(spacing: Theme.Spacing.xs) {
            ForEach(0..<3) { i in
                Circle()
                    .frame(width: 6, height: 6)
                    .opacity(tick ? 0.3 : 1.0)
                    .animation(
                        .easeInOut(duration: 0.6).repeatForever().delay(Double(i) * 0.15),
                        value: tick
                    )
            }
        }
        .foregroundStyle(Theme.textSecondary)
        .padding(.horizontal, Theme.Spacing.m)
        .padding(.vertical, Theme.Spacing.s)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m))
        .onAppear { tick = true }
    }
}

private struct Composer: View {
    @Binding var draft: String
    let isSending: Bool
    var isFocused: FocusState<Bool>.Binding
    let onSubmit: () -> Void

    var body: some View {
        HStack(alignment: .bottom, spacing: Theme.Spacing.s) {
            TextField("Ask…", text: $draft, axis: .vertical)
                .lineLimit(1...5)
                .padding(.horizontal, Theme.Spacing.m)
                .padding(.vertical, Theme.Spacing.s)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m))
                .focused(isFocused)
            Button(action: onSubmit) {
                Image(systemName: isSending ? "ellipsis" : "arrow.up.circle.fill")
                    .font(.system(size: 30))
                    .foregroundStyle(canSend ? Theme.accent : Theme.textSecondary)
            }
            .disabled(!canSend)
        }
        .padding(.horizontal, Theme.Spacing.l)
        .padding(.vertical, Theme.Spacing.s)
    }

    private var canSend: Bool {
        !isSending && !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}
