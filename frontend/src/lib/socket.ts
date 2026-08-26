type EventHandler = (data: any) => void;

class SocketClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private currentShowId: string | null = null;
  private reconnectTimer: any = null;

  connect(showId?: string) {
    if (showId) {
      this.currentShowId = showId;
    }
    if (!this.currentShowId) return;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const customWs = import.meta.env.VITE_WS_BASE_URL;
    let url: string;

    if (customWs) {
      const clean = customWs.replace(/\/$/, '');
      url = clean.includes('/ws/shows')
        ? `${clean}/${this.currentShowId}`
        : `${clean}/api/v1/ws/shows/${this.currentShowId}`;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.port === '5173' ? `${window.location.hostname}:5000` : window.location.host;
      url = `${protocol}//${host}/api/v1/ws/shows/${this.currentShowId}`;
    }

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const eventName = payload.event;
          const data = payload.data || payload;
          if (eventName && this.listeners.has(eventName)) {
            this.listeners.get(eventName)?.forEach((cb) => cb(data));
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      this.ws.onclose = () => {
        if (this.currentShowId && !this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.connect();
          }, 3000);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket error (non-fatal):', err);
      };
    } catch (err) {
      console.warn('Failed to establish WebSocket (non-fatal):', err);
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.currentShowId = null;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  on(event: string, callback: EventHandler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  }

  off(event: string, callback: EventHandler) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)?.delete(callback);
    }
  }

  emit(event: string, data?: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, ...data }));
    }
  }
}

const socket = new SocketClient();
export default socket;
