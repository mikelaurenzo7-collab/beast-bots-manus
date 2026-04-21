import SwiftUI

struct ChatView: View {
    @StateObject private var vm = ChatViewModel()
    @State private var draft = ""
    @FocusState private var inputFocused: Bool

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: Theme.Spacing.l) {
                            if vm.messages.isEmpty {
                                EmptyChatHint()
                                    .padding(.top, Theme.Spacing.xl * 2)
                            } else {
                                ForEach(vm.messages) { message in
                                    MessageRow(
                                        message: message,
                                        toolCalls: message.runId.flatMap { vm.toolCallsByRunId[$0] } ?? []
                                    )
                                    .id(message.id)
                                }
                            }
                            if vm.isSending {
                                TypingIndicator()
                                    .id("typing")
                            }
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
                    isFocused: $inputFocused,
                    onSubmit: send
                )
            }
            .navigationTitle("Bot Boss")
            .navigationBarTitleDisplayMode(.inline)
            .task { await vm.loadHistory() }
            .alert("Something went wrong",
                   isPresented: Binding(
                       get: { vm.errorMessage != nil },
                       set: { _ in vm.errorMessage = nil }
                   ),
                   actions: { Button("OK") {} },
                   message: { Text(vm.errorMessage ?? "") })
        }
    }

    private func send() {
        let text = draft
        draft = ""
        Task { await vm.send(text) }
    }
}

private struct EmptyChatHint: View {
    var body: some View {
        VStack(spacing: Theme.Spacing.m) {
            Image(systemName: "bolt.fill")
                .font(.system(size: 48))
                .foregroundStyle(Theme.accent)
            Text("Tell the Boss what you need.")
                .font(.title3.weight(.semibold))
            Text("Try: “Find three recent articles on SwiftUI performance and save a note with links.”")
                .font(.footnote)
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, Theme.Spacing.xl)
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
                    .background(bubbleColor)
                    .foregroundStyle(textColor)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m))
                if message.role == .assistant { Spacer(minLength: 40) }
            }

            if !toolCalls.isEmpty {
                ToolCallChips(toolCalls: toolCalls)
            }
        }
        .frame(maxWidth: .infinity, alignment: message.role == .user ? .trailing : .leading)
    }

    private var bubbleColor: Color {
        message.role == .user ? Theme.accent : Theme.surface
    }
    private var textColor: Color {
        message.role == .user ? .white : Theme.textPrimary
    }
}

private struct ToolCallChips: View {
    let toolCalls: [ToolCallSummary]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Spacing.s) {
                ForEach(toolCalls) { call in
                    HStack(spacing: Theme.Spacing.xs) {
                        Image(systemName: call.ok ? "checkmark.circle.fill" : "xmark.octagon.fill")
                            .foregroundStyle(call.ok ? .green : .red)
                        Text(call.label).font(.caption.weight(.medium))
                        Text("· \(call.summary)")
                            .font(.caption)
                            .foregroundStyle(Theme.textSecondary)
                            .lineLimit(1)
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
        .frame(maxWidth: .infinity, alignment: .leading)
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
            TextField("Ask the Boss…", text: $draft, axis: .vertical)
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
        .background(
            Rectangle()
                .fill(Theme.background)
                .shadow(color: .black.opacity(0.05), radius: 8, y: -2)
                .ignoresSafeArea(edges: .bottom)
        )
    }

    private var canSend: Bool {
        !isSending && !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}
