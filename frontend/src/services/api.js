const BASE_URL = '/v1';

export async function fetchApi(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

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

// Sessions APIs
export async function getSessions(status = 'ACTIVE') {
  return fetchApi(`/sessions?status=${status}`);
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

  const response = await fetch(`${BASE_URL}/sessions/${sessionId}/documents`, {
    method: 'POST',
    body: formData,
  });

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
    const response = await fetch(`${BASE_URL}/sessions/${sessionId}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, stream: true }),
    });

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
          // not json, or raw text chunk
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
