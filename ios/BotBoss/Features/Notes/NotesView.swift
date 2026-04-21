import SwiftUI

@MainActor
final class NotesViewModel: ObservableObject {
    @Published private(set) var notes: [Note] = []
    @Published var errorMessage: String?

    func load() async {
        do {
            let resp: NotesResponse = try await APIClient.shared.get("/v1/notes")
            self.notes = resp.notes
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct NotesView: View {
    @StateObject private var vm = NotesViewModel()

    var body: some View {
        List {
            if vm.notes.isEmpty {
                ContentUnavailableView(
                    "No notes yet",
                    systemImage: "note.text",
                    description: Text("When the Boss saves a note for you, it shows up here.")
                )
            } else {
                ForEach(vm.notes) { note in
                    NavigationLink(value: note) {
                        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                            Text(note.title).font(.headline)
                            Text(note.body)
                                .font(.footnote)
                                .foregroundStyle(Theme.textSecondary)
                                .lineLimit(2)
                            Text(note.updatedAt, style: .relative)
                                .font(.caption2)
                                .foregroundStyle(Theme.textSecondary)
                        }
                    }
                }
            }
        }
        .navigationTitle("Notes")
        .task { await vm.load() }
        .refreshable { await vm.load() }
        .navigationDestination(for: Note.self) { note in
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.m) {
                    Text(note.title).font(.title2.weight(.bold))
                    Text(note.updatedAt.formatted())
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                    Text(note.body).font(.body)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
            }
            .navigationTitle(note.title)
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
