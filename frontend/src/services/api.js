const BASE_URL = '/v1';

// Token Management
export function getAuthToken() {
  return localStorage.getItem('token');
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
}

export function getUser() {
  const user = localStorage.getItem('user');
  try {
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

export function setUser(user) {
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  } else {
    localStorage.removeItem('user');
  }
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export async function fetchApi(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const token = getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // If unauthorized, clear storage
    logout();
    window.dispatchEvent(new Event('auth:unauthorized'));
  }

  if (!response.ok) {
    let errorData = {};
    try {
      errorData = await response.json();
    } catch {
      // ignore
    }
    const message = errorData.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}

// Auth APIs
export async function loginUser(email, password) {
  const res = await fetchApi('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const data = res.response || res.data;
  if (data?.token) {
    setAuthToken(data.token);
    setUser(data.user);
  }
  return data;
}

export async function signupUser(name, email, password) {
  const res = await fetchApi('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  const data = res.response || res.data;
  if (data?.token) {
    setAuthToken(data.token);
    setUser(data.user);
  }
  return data;
}

export async function getProfile() {
  return fetchApi('/auth/me');
}

// Sessions APIs
export async function getSessions(status = 'ACTIVE') {
  return fetchApi(`/sessions?status=${status}`);
}

export async function getSessionById(sessionId) {
  return fetchApi(`/sessions/${sessionId}`);
}

export async function createSession(data) {
  return fetchApi('/sessions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSession(sessionId, data) {
  return fetchApi(`/sessions/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteSession(sessionId) {
  return fetchApi(`/sessions/${sessionId}`, {
    method: 'DELETE',
  });
}

// Document APIs
export async function getSessionDocuments(sessionId) {
  return fetchApi(`/sessions/${sessionId}/documents`);
}

export async function uploadDocuments(sessionId, files) {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  const token = getAuthToken();

  const response = await fetch(`${BASE_URL}/sessions/${sessionId}/documents`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (response.status === 401) {
    logout();
    window.dispatchEvent(new Event('auth:unauthorized'));
  }

  if (!response.ok) {
    let errorData = {};
    try {
      errorData = await response.json();
    } catch {
      // ignore
    }
    throw new Error(errorData.message || 'Upload failed');
  }

  return response.json();
}

export async function getDocumentPreviewUrl(sessionId, documentId) {
  return fetchApi(`/sessions/${sessionId}/documents/${documentId}/preview`);
}

export async function deleteDocument(sessionId, documentId) {
  return fetchApi(`/sessions/${sessionId}/documents/${documentId}`, {
    method: 'DELETE',
  });
}

// Chat / Query APIs
export async function getSessionMessages(sessionId) {
  return fetchApi(`/sessions/${sessionId}/messages`);
}

export async function streamQuery(sessionId, prompt, { onToken, onCitations, onError, onComplete }) {
  try {
    const token = getAuthToken();
    const response = await fetch(`${BASE_URL}/sessions/${sessionId}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ prompt, stream: true }),
    });

    if (response.status === 401) {
      logout();
      window.dispatchEvent(new Event('auth:unauthorized'));
      throw new Error('Unauthorized. Please login again.');
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to query session');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep partial line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const dataStr = trimmed.replace(/^data: /, '').trim();

        if (dataStr === '[DONE]') {
          if (onComplete) onComplete();
          return;
        }

        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.type === 'token' && onToken) {
            onToken(parsed.content);
          } else if (parsed.type === 'citations' && onCitations) {
            onCitations(parsed.citations);
          } else if (parsed.type === 'error' && onError) {
            onError(new Error(parsed.message || 'Stream error'));
          }
        } catch {
          if (onToken) onToken(dataStr);
        }
      }
    }

    if (onComplete) onComplete();
  } catch (err) {
    if (onError) onError(err);
    else throw err;
  }
}
