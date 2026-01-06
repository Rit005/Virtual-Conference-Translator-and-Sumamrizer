/**
 * ListenerManager - Production-grade event listener management
 * Prevents duplicate listeners, memory leaks, and WebSocket crashes
 */

class ListenerManager {
  constructor() {
    this.listeners = new Map();           // event -> Set(callback)
    this.socketListeners = new Map();
    this.listenerIds = new Map();          // callback -> id
    this.eventSources = new Map();         // id -> metadata
    this.cleanupCallbacks = new Map();
    this.componentListeners = new Map();

    this.nextListenerId = 0;

    this.stats = {
      totalListeners: 0,
      duplicatePrevented: 0,
      cleanedUp: 0,
      socketListeners: 0,
      componentListeners: 0
    };

    this.debugMode = process.env.NODE_ENV === 'development';
  }

  /* ------------------------------------------------------------------ */
  /* ADD LISTENERS                                                       */
  /* ------------------------------------------------------------------ */

  addListener(event, callback, source = 'custom', options = {}) {
    if (this.listeners.get(event)?.has(callback)) {
      this.stats.duplicatePrevented++;
      return null;
    }

    const listenerId = `listener_${this.nextListenerId++}`;

    this.listenerIds.set(callback, listenerId);
    this.eventSources.set(listenerId, {
      event,
      source,
      addedAt: Date.now(),
      functionName: callback.name || 'anonymous',
      options
    });

    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    this.stats.totalListeners++;

    if (this.debugMode) {
      console.log(`✅ Listener added: ${event}`, listenerId);
    }

    return listenerId;
  }

  /* ------------------------------------------------------------------ */
  /* REMOVE LISTENERS                                                    */
  /* ------------------------------------------------------------------ */

  removeListener(event, callback) {
    if (!this.listeners.has(event)) return false;

    const listenerId = this.listenerIds.get(callback);
    if (!listenerId) return false;

    this.listeners.get(event).delete(callback);
    this.listenerIds.delete(callback);
    this.eventSources.delete(listenerId);

    const cleanup = this.cleanupCallbacks.get(listenerId);
    if (cleanup) cleanup();

    this.cleanupCallbacks.delete(listenerId);
    this.stats.cleanedUp++;
    this.stats.totalListeners--;

    return true;
  }

  removeListenerByCallback(event, callback) {
    return this.removeListener(event, callback);
  }

  removeListenerById(listenerId) {
    for (const [cb, id] of this.listenerIds.entries()) {
      if (id === listenerId) {
        const info = this.eventSources.get(listenerId);
        return this.removeListener(info.event, cb);
      }
    }
    return false;
  }

  removeAllListeners() {
    for (const [event, callbacks] of this.listeners.entries()) {
      for (const cb of callbacks) {
        this.removeListener(event, cb);
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* REQUIRED BY WebSocketService.emit()                                 */
  /* ------------------------------------------------------------------ */

  getListeners(event) {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return [];

    return Array.from(callbacks).map(callback => {
      const id = this.listenerIds.get(callback);
      const info = this.eventSources.get(id);

      return {
        id,
        event,
        callback,
        source: info?.source || 'unknown'
      };
    });
  }

  /* ------------------------------------------------------------------ */
  /* CLEANUP                                                             */
  /* ------------------------------------------------------------------ */

  cleanup() {
    this.removeAllListeners();
    this.listeners.clear();
    this.listenerIds.clear();
    this.eventSources.clear();
    this.cleanupCallbacks.clear();
    this.componentListeners.clear();
    this.nextListenerId = 0;
  }
}

export default ListenerManager;
