import SwiftUI

struct ContentView: View {
    @State private var inputText = ""
    @State private var isProcessing = false
    @State private var result: ActionResult?
    @State private var showResult = false
    @FocusState private var isTextFocused: Bool

    private let router = ActionRouter()

    var body: some View {
        ZStack {
            Color(.systemBackground)
                .ignoresSafeArea()

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
                            Text("Type anything... \"remind me to call mom tomorrow\", \"meeting at 3pm Friday\"")
                                .font(.body)
                                .foregroundStyle(.tertiary)
                                .padding(.horizontal, 28)
                                .padding(.vertical, 20)
                                .allowsHitTesting(false)
                        }
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
                    .background(inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isProcessing
                        ? Color.accentColor.opacity(0.4)
                        : Color.accentColor)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .disabled(inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isProcessing)
                .padding()
            }
        }
        .onAppear {
            isTextFocused = true
        }
        .sheet(isPresented: $showResult) {
            if let result = result {
                ConfirmationView(result: result) {
                    showResult = false
                    inputText = ""
                    isTextFocused = true
                }
                .presentationDetents([.fraction(0.35)])
            }
        }
    }

    private func send() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }

        isProcessing = true

        Task {
            let actionResult = await router.process(text)
            await MainActor.run {
                result = actionResult
                isProcessing = false
                showResult = true
            }
        }
    }
}

#Preview {
    ContentView()
}
