import SwiftUI

@MainActor
final class RecipesViewModel: ObservableObject {
    @Published private(set) var recipes: [Recipe] = []
    @Published var errorMessage: String?
    @Published private(set) var isLoading = false

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let resp: RecipesResponse = try await APIClient.shared.get("/v1/recipes")
            self.recipes = resp.recipes
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func delete(_ recipe: Recipe) async {
        do {
            let _: OKResponse = try await APIClient.shared.delete("/v1/recipes/\(recipe.id)")
            self.recipes.removeAll { $0.id == recipe.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct RecipesView: View {
    @StateObject private var vm = RecipesViewModel()
    @State private var showEditor = false
    @State private var editing: Recipe?

    var body: some View {
        NavigationStack {
            Group {
                if vm.recipes.isEmpty && !vm.isLoading {
                    EmptyRecipes(onCreate: { editing = nil; showEditor = true })
                } else {
                    List {
                        ForEach(vm.recipes) { recipe in
                            Button {
                                editing = recipe
                                showEditor = true
                            } label: {
                                RecipeRow(recipe: recipe)
                            }
                            .buttonStyle(.plain)
                            .swipeActions {
                                Button(role: .destructive) {
                                    Task { await vm.delete(recipe) }
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                        }
                    }
                    .listStyle(.plain)
                    .refreshable { await vm.load() }
                }
            }
            .navigationTitle("Recipes")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        editing = nil
                        showEditor = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                    }
                }
            }
            .task { await vm.load() }
            .sheet(isPresented: $showEditor, onDismiss: { Task { await vm.load() } }) {
                RecipeEditorView(recipe: editing)
            }
        }
    }
}

private struct RecipeRow: View {
    let recipe: Recipe

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            HStack {
                Text(recipe.name).font(.headline)
                Spacer()
                Label(recipe.triggerKind.rawValue, systemImage: triggerIcon)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(Theme.textSecondary)
            }
            Text(recipe.prompt)
                .font(.footnote)
                .foregroundStyle(Theme.textSecondary)
                .lineLimit(2)
            HStack(spacing: Theme.Spacing.xs) {
                ForEach(recipe.tools.prefix(4), id: \.self) { tool in
                    Text(tool)
                        .font(.caption2.monospaced())
                        .padding(.horizontal, Theme.Spacing.s)
                        .padding(.vertical, 2)
                        .background(Theme.surface)
                        .clipShape(Capsule())
                }
                if recipe.tools.count > 4 {
                    Text("+\(recipe.tools.count - 4)")
                        .font(.caption2)
                        .foregroundStyle(Theme.textSecondary)
                }
            }
        }
        .padding(.vertical, Theme.Spacing.xs)
    }

    private var triggerIcon: String {
        switch recipe.triggerKind {
        case .manual: return "hand.tap"
        case .schedule: return "clock"
        case .webhook: return "network"
        }
    }
}

private struct EmptyRecipes: View {
    let onCreate: () -> Void

    var body: some View {
        VStack(spacing: Theme.Spacing.m) {
            Image(systemName: "list.bullet.rectangle")
                .font(.system(size: 48))
                .foregroundStyle(Theme.textSecondary)
            Text("No recipes yet")
                .font(.title3.weight(.semibold))
            Text("A recipe is a saved prompt + tool allowlist the Boss reuses on demand or on a schedule.")
                .font(.footnote)
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Theme.Spacing.xl)
            Button(action: onCreate) {
                Label("New recipe", systemImage: "plus")
                    .padding(.horizontal, Theme.Spacing.l)
                    .padding(.vertical, Theme.Spacing.s)
                    .background(Theme.accent)
                    .foregroundStyle(.white)
                    .clipShape(Capsule())
            }
            .padding(.top, Theme.Spacing.s)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
}
