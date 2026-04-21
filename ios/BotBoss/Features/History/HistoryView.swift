import SwiftUI

@MainActor
final class HistoryViewModel: ObservableObject {
    @Published private(set) var runs: [Run] = []
    @Published var errorMessage: String?
    @Published private(set) var isLoading = false

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let resp: RunsResponse = try await APIClient.shared.get("/v1/runs")
            self.runs = resp.runs
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct HistoryView: View {
    @StateObject private var vm = HistoryViewModel()

    var body: some View {
        NavigationStack {
            List {
                if vm.runs.isEmpty && !vm.isLoading {
                    ContentUnavailableView(
                        "No runs yet",
                        systemImage: "clock.arrow.circlepath",
                        description: Text("Ask the Boss something to create a run.")
                    )
                } else {
                    ForEach(vm.runs) { run in
                        NavigationLink(value: run) {
                            RunRow(run: run)
                        }
                    }
                }
            }
            .navigationTitle("History")
            .task { await vm.load() }
            .refreshable { await vm.load() }
            .navigationDestination(for: Run.self) { RunDetailView(run: $0) }
        }
    }
}

private struct RunRow: View {
    let run: Run

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            HStack {
                statusChip
                Text(run.createdAt, style: .relative)
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
                Spacer()
                if let ms = run.durationMs {
                    Text("\(ms) ms").font(.caption.monospaced()).foregroundStyle(Theme.textSecondary)
                }
            }
            if let input = run.inputSummary, !input.isEmpty {
                Text(input).font(.subheadline).lineLimit(1)
            }
            if let output = run.outputSummary, !output.isEmpty {
                Text(output).font(.footnote).foregroundStyle(Theme.textSecondary).lineLimit(2)
            }
        }
        .padding(.vertical, Theme.Spacing.xs)
    }

    private var statusChip: some View {
        Text(run.status.rawValue.uppercased())
            .font(.caption2.weight(.bold).monospaced())
            .padding(.horizontal, Theme.Spacing.s)
            .padding(.vertical, 2)
            .foregroundStyle(.white)
            .background(statusColor)
            .clipShape(Capsule())
    }

    private var statusColor: Color {
        switch run.status {
        case .running: return .orange
        case .success: return .green
        case .error: return .red
        }
    }
}

struct RunDetailView: View {
    let run: Run

    var body: some View {
        Form {
            Section("Status") {
                LabeledContent("State", value: run.status.rawValue)
                LabeledContent("Started", value: run.createdAt.formatted())
                if let ms = run.durationMs { LabeledContent("Duration", value: "\(ms) ms") }
                if let tokens = run.tokensUsed { LabeledContent("Tokens", value: "\(tokens)") }
            }
            if let input = run.inputSummary, !input.isEmpty {
                Section("Prompt") { Text(input) }
            }
            if let output = run.outputSummary, !output.isEmpty {
                Section("Reply") { Text(output) }
            }
            if let calls = run.toolCalls, !calls.isEmpty {
                Section("Tool calls") {
                    ForEach(calls, id: \.summary) { call in
                        HStack {
                            Image(systemName: call.ok ? "checkmark.circle.fill" : "xmark.octagon.fill")
                                .foregroundStyle(call.ok ? .green : .red)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(call.name).font(.caption.monospaced())
                                Text(call.summary).font(.caption).foregroundStyle(Theme.textSecondary)
                            }
                        }
                    }
                }
            }
            if let error = run.errorMessage, !error.isEmpty {
                Section("Error") { Text(error).foregroundStyle(.red) }
            }
        }
        .navigationTitle("Run #\(run.id)")
        .navigationBarTitleDisplayMode(.inline)
    }
}
