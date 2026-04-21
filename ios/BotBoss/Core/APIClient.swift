import Foundation

/// Errors surfaced from the REST client. `.http` carries the server's JSON
/// error body when present so callers can show meaningful messages.
enum APIError: Error, LocalizedError {
    case notAuthenticated
    case transport(Error)
    case http(status: Int, message: String)
    case decoding(Error)

    var errorDescription: String? {
        switch self {
        case .notAuthenticated: return "You're signed out."
        case .transport(let e): return e.localizedDescription
        case .http(_, let m): return m
        case .decoding(let e): return "Bad response: \(e.localizedDescription)"
        }
    }
}

/// Minimal async REST client. Does exactly two things:
/// 1. Attaches the session bearer token (via `Keychain`) when `requiresAuth`.
/// 2. Decodes snake_case + ISO-8601 JSON into Codable models.
final class APIClient {
    static let shared = APIClient()

    private let base: URL
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    init(base: URL = AppConfig.apiBaseURL, session: URLSession = .shared) {
        self.base = base
        self.session = session

        let dec = JSONDecoder()
        dec.dateDecodingStrategy = .custom { decoder in
            let raw = try decoder.singleValueContainer().decode(String.self)
            if let d = ISO8601DateFormatter.withFractional.date(from: raw) { return d }
            if let d = ISO8601DateFormatter.plain.date(from: raw) { return d }
            throw DecodingError.dataCorruptedError(
                in: try decoder.singleValueContainer(),
                debugDescription: "Invalid ISO-8601 date: \(raw)"
            )
        }
        self.decoder = dec

        let enc = JSONEncoder()
        enc.dateEncodingStrategy = .iso8601
        self.encoder = enc
    }

    func get<Response: Decodable>(
        _ path: String,
        query: [String: String] = [:],
        as _: Response.Type = Response.self,
        requiresAuth: Bool = true
    ) async throws -> Response {
        try await send(method: "GET", path: path, query: query, body: Optional<Empty>.none,
                       requiresAuth: requiresAuth)
    }

    func post<Body: Encodable, Response: Decodable>(
        _ path: String,
        body: Body,
        as _: Response.Type = Response.self,
        requiresAuth: Bool = true
    ) async throws -> Response {
        try await send(method: "POST", path: path, body: body, requiresAuth: requiresAuth)
    }

    func patch<Body: Encodable, Response: Decodable>(
        _ path: String,
        body: Body,
        as _: Response.Type = Response.self,
        requiresAuth: Bool = true
    ) async throws -> Response {
        try await send(method: "PATCH", path: path, body: body, requiresAuth: requiresAuth)
    }

    func delete<Response: Decodable>(
        _ path: String,
        as _: Response.Type = Response.self,
        requiresAuth: Bool = true
    ) async throws -> Response {
        try await send(method: "DELETE", path: path, body: Optional<Empty>.none,
                       requiresAuth: requiresAuth)
    }

    // MARK: -

    private struct Empty: Codable {}
    private struct ServerError: Decodable { let error: String }

    private func send<Body: Encodable, Response: Decodable>(
        method: String,
        path: String,
        query: [String: String] = [:],
        body: Body?,
        requiresAuth: Bool
    ) async throws -> Response {
        var components = URLComponents(
            url: base.appendingPathComponent(path),
            resolvingAgainstBaseURL: false
        )!
        if !query.isEmpty {
            components.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }

        var req = URLRequest(url: components.url!)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")

        if requiresAuth {
            guard let token = Keychain.get(.sessionToken) else { throw APIError.notAuthenticated }
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body = body, !(body is Empty) {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try encoder.encode(body)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw APIError.transport(error)
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.http(status: 0, message: "No HTTP response")
        }

        guard (200..<300).contains(http.statusCode) else {
            let message = (try? decoder.decode(ServerError.self, from: data).error)
                ?? String(data: data, encoding: .utf8)
                ?? "Request failed"
            throw APIError.http(status: http.statusCode, message: message)
        }

        do {
            return try decoder.decode(Response.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }
}

private extension ISO8601DateFormatter {
    static let plain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()
    static let withFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
}
