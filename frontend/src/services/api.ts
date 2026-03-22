let _apiBase: string | null = null
let _configPromise: Promise<void> | null = null

async function loadApiConfig(): Promise<void> {
  if (_apiBase) return
  try {
    const response = await fetch("/aws-exports.json")
    if (response.ok) {
      const config = await response.json()
      const feedbackUrl: string = config.feedbackApiUrl || ""
      _apiBase = feedbackUrl.replace(/\/$/, "")
    }
  } catch {
    console.warn("Failed to load API config, falling back to relative /api")
  }
  if (!_apiBase) {
    _apiBase = "/api"
  }
}

function getApiBase(): Promise<string> {
  if (_apiBase) return Promise.resolve(_apiBase)
  if (!_configPromise) _configPromise = loadApiConfig()
  return _configPromise.then(() => _apiBase || "/api")
}

function getIdToken(): string | null {
  // Cognito User Pools Authorizer expects an id_token.
  // The OIDC library stores user data with key "oidc.user:<authority>:<client_id>".
  // The store location depends on AuthProvider config — check both localStorage and sessionStorage.
  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (const key of Object.keys(storage)) {
      if (key.startsWith("oidc.user:")) {
        try {
          const data = JSON.parse(storage.getItem(key) || "{}")
          if (data.id_token) return data.id_token
        } catch {
          continue
        }
      }
    }
  }
  return null
}

interface RequestOptions {
  method?: string
  body?: any
  headers?: Record<string, string>
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const base = await getApiBase()
  const token = getIdToken()
  const { method = "GET", body, headers = {} } = options

  if (!token) {
    throw new Error("Not authenticated. Token not yet available.")
  }

  const response = await fetch(`${base}/api${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error || `API error: ${response.status}`)
  }

  return response.json()
}
