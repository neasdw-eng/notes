import SwiftUI

struct ContentView: View {
    @StateObject private var router = ActionRouter()
    @State private var inputText = ""
    @State private var isProcessing = false
    @State private var result: ActionResult?
    @State private var detectedIntent: ActionIntent?
    @FocusState private var isTextFocused: Bool

    var body: some View {
        ZStack {
            Color(.systemBackground)
                .ignoresSafeArea()
                .onTapGesture {
                    isTextFocused = false
                }

            VStack(spacing: 0) {
                // Header
                HStack {
                    Text("ActionPad")
                        .font(.title2)
                        .fontWeight(.bold)
                    Spacer()
                }
                .padding(.horizontal)
                .padding(.top, 8)
                .padding(.bottom, 12)

                // Text input
                TextEditor(text: $inputText)
                    .focused($isTextFocused)
                    .font(.body)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .scrollContentBackground(.hidden)
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .padding(.horizontal)
                    .overlay(alignment: .topLeading) {
                        if inputText.isEmpty {
                            Text("What do you need to do?\n\"remind me to call mom tomorrow\"\n\"meeting at 3pm Friday\"\n\"buy groceries\"")
                                .font(.body)
                                .foregroundStyle(.tertiary)
                                .padding(.horizontal, 28)
                                .padding(.vertical, 20)
                                .allowsHitTesting(false)
                        }
                    }
                    .onChange(of: inputText) { _ in
                        updatePreview()
                    }

                // Intent preview chip
                if let intent = detectedIntent, !inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    HStack(spacing: 6) {
                        Image(systemName: intent.iconName)
                            .font(.caption)
                        Text("Will create: \(intent.displayName)")
                            .font(.caption)
                    }
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color(.tertiarySystemBackground))
                    .clipShape(Capsule())
                    .padding(.top, 8)
                    .transition(.opacity)
                    .animation(.easeInOut(duration: 0.2), value: detectedIntent)
                }

                // Send button
                Button {
                    send()
                } label: {
                    HStack(spacing: 8) {
                        if isProcessing {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Image(systemName: "paperplane.fill")
                        }
                        Text(isProcessing ? "Processing..." : "Send")
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(canSend ? Color.accentColor : Color.accentColor.opacity(0.4))
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .disabled(!canSend)
                .padding()
            }
        }
        .onAppear {
            isTextFocused = true
        }
        .sheet(item: $result) { res in
            ConfirmationView(result: res) {
                result = nil
                inputText = ""
                detectedIntent = nil
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    isTextFocused = true
                }
            }
            .presentationDetents([.fraction(0.4), .medium])
        }
    }

    private var canSend: Bool {
        !inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isProcessing
    }

    private func updatePreview() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else {
            detectedIntent = nil
            return
        }
        let preview = router.preview(text)
        detectedIntent = preview.isUnparseable ? nil : preview.intent
    }

    private func send() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }

        isProcessing = true
        isTextFocused = false

        Task {
            let actionResult = await router.process(text)
            await MainActor.run {
                result = actionResult
                isProcessing = false
            }
        }
    }
}

#Preview {
    ContentView()
}
