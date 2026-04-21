import SwiftUI

struct RecipeEditorView: View {
    let recipe: Recipe?

    @Environment(\.dismiss) private var dismiss
    @State private var name: String = ""
    @State private var prompt: String = ""
    @State private var selectedTools: Set<String> = Set(BuiltinTools.defaults)
    @State private var triggerKind: Recipe.TriggerKind = .manual
    @State private var triggerCron: String = "0 9 * * *"
    @State private var isSaving = false
    @State private var errorMessage: String?

    private var isEditing: Bool { recipe != nil }

    var body: some View {
        NavigationStack {
            Form {
                Section("Name") {
                    TextField("e.g. Daily news digest", text: $name)
                        .textInputAutocapitalization(.sentences)
                }

                Section {
                    TextEditor(text: $prompt)
                        .frame(minHeight: 120)
                        .font(.body)
                } header: {
                    Text("Prompt")
                } footer: {
                    Text("Describe what the Boss should do, step by step.")
                }

                Section("Tools") {
                    ForEach(BuiltinTools.all, id: \.name) { tool in
                        Toggle(isOn: Binding(
                            get: { selectedTools.contains(tool.name) },
                            set: { on in
                                if on { selectedTools.insert(tool.name) }
                                else { selectedTools.remove(tool.name) }
                            }
                        )) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(tool.label).font(.body)
                                Text(tool.name).font(.caption.monospaced()).foregroundStyle(Theme.textSecondary)
                            }
                        }
                    }
                }

                Section("Trigger") {
                    Picker("When", selection: $triggerKind) {
                        Text("Manual").tag(Recipe.TriggerKind.manual)
                        Text("On a schedule").tag(Recipe.TriggerKind.schedule)
                    }
                    if triggerKind == .schedule {
                        TextField("cron (e.g. 0 9 * * *)", text: $triggerCron)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                            .font(.body.monospaced())
                    }
                }

                if let errorMessage {
                    Section { Text(errorMessage).foregroundStyle(.red) }
                }
            }
            .navigationTitle(isEditing ? "Edit recipe" : "New recipe")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }
                        .disabled(!canSave || isSaving)
                }
            }
            .onAppear(perform: hydrate)
        }
    }

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty &&
        !prompt.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private func hydrate() {
        guard let recipe else { return }
        name = recipe.name
        prompt = recipe.prompt
        selectedTools = Set(recipe.tools)
        triggerKind = recipe.triggerKind
        triggerCron = recipe.triggerCron ?? triggerCron
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }

        struct Body: Encodable {
            let name: String
            let prompt: String
            let tools: [String]
            let triggerKind: String
            let triggerCron: String?
        }

        let body = Body(
            name: name,
            prompt: prompt,
            tools: Array(selectedTools).sorted(),
            triggerKind: triggerKind.rawValue,
            triggerCron: triggerKind == .schedule ? triggerCron : nil
        )

        do {
            if let recipe {
                let _: OKResponse = try await APIClient.shared.patch(
                    "/v1/recipes/\(recipe.id)",
                    body: body
                )
            } else {
                let _: RecipeResponse = try await APIClient.shared.post(
                    "/v1/recipes",
                    body: body
                )
            }
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

enum BuiltinTools {
    struct Descriptor {
        let name: String
        let label: String
    }

    static let all: [Descriptor] = [
        .init(name: "web.search", label: "Search the web"),
        .init(name: "web.fetch", label: "Fetch a URL"),
        .init(name: "time.now", label: "Current time"),
        .init(name: "notes.save", label: "Save note"),
        .init(name: "notes.list", label: "List notes"),
        .init(name: "notes.get", label: "Read note"),
        .init(name: "math.calculate", label: "Calculator"),
        .init(name: "report.table", label: "Format table"),
    ]

    static let defaults: [String] = all.map(\.name)
}
