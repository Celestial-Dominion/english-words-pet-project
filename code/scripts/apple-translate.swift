// Dịch Anh → Việt bằng bộ dịch có sẵn của macOS (Translation.framework, chạy trên máy, không gọi mạng, không bị chặn).
// content-mt.mjs tự biên dịch file này khi chạy với CONTENT_MT_ENGINE=apple — không cần gọi tay.
//   stdin: mảng JSON các câu tiếng Anh → stdout: mảng JSON bản dịch, đúng thứ tự.
// Cần macOS 26+ và gói ngôn ngữ đã tải: Cài đặt hệ thống → Cài đặt chung → Ngôn ngữ & Vùng → Ngôn ngữ dịch… →
// tải English và Tiếng Việt. Chưa tải thì thoát mã 3 kèm hướng dẫn.
import Foundation
import Translation

@main struct AppleTranslate {
  static func main() async {
    let en = Locale.Language(identifier: "en")
    let vi = Locale.Language(identifier: "vi")
    let status = await LanguageAvailability().status(from: en, to: vi)
    guard status == .installed else {
      FileHandle.standardError.write(
        "GÓI DỊCH CHƯA TẢI (\(status)): Cài đặt hệ thống → Cài đặt chung → Ngôn ngữ & Vùng → Ngôn ngữ dịch… → tải English và Tiếng Việt\n"
          .data(using: .utf8)!)
      exit(3)
    }
    do {
      let input = FileHandle.standardInput.readDataToEndOfFile()
      guard let lines = try JSONSerialization.jsonObject(with: input) as? [String] else {
        FileHandle.standardError.write("stdin phải là mảng JSON các chuỗi\n".data(using: .utf8)!)
        exit(2)
      }
      let session = TranslationSession(installedSource: en, target: vi)
      let requests = lines.enumerated().map { TranslationSession.Request(sourceText: $1, clientIdentifier: String($0)) }
      var out = Array(repeating: "", count: lines.count)
      for r in try await session.translations(from: requests) {
        if let id = r.clientIdentifier, let i = Int(id) { out[i] = r.targetText }
      }
      FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject: out))
    } catch {
      FileHandle.standardError.write("LỖI dịch: \(error)\n".data(using: .utf8)!)
      exit(1)
    }
  }
}
