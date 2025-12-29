/**
 * ListenerManager - Production-grade event listener management
 * Prevents duplicate listeners, memory leaks, and WebSocket crashes
 */

class ListenerManager {
  constructor() {
    this.listeners = new Map();           
    this.socketListeners = new Map();   
    this.listenerIds = new Map();          
    this.eventSources = new Map();         
    this.cleanupCallbacks = new Map();     
    this.componentListeners = new Map();   

    this.nextListenerId = 0;

    this.stats = {
      totalListeners: 0,
      duplicatePrevented: 0,
      cleanedUp: 0,
      socketListeners: 0,
      componentListeners: 0,
      successCount: 0,
      errorCount: 0
    };

    this.debugMode = process.env.NODE_ENV === 'development';
  }

  /* ------------------------------------------------------------------ */
  /* ADD LISTENERS                                                       */
  /* ------------------------------------------------------------------ */

  addListener(event, callback, source = 'custom', options = {}) {
    if (this.hasExactDuplicate(event, callback)) {
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

    if (source === 'websocket') {
      if (!this.socketListeners.has(event)) {
        this.socketListeners.set(event, new Set());
      }
      this.socketListeners.get(event).add(callback);
      this.stats.socketListeners++;
    } else {
      this.stats.componentListeners++;
    }

    this.stats.totalListeners++;

    if (this.debugMode) {
      console.log(`✅ Listener added: ${event}`, { listenerId, source });
    }

    return listenerId;
  }

  addSocketListener(socket, event, callback, options = {}) {
    const listenerId = this.addListener(event, callback, 'websocket', options);
    if (!listenerId || !socket) return null;

    socket.on(event, callback);

    this.cleanupCallbacks.set(listenerId, () => {
      try {
        socket.off(event, callback);
      } catch {}
    });

    return listenerId;
  }

  addComponentListener(componentId, event, callback, cleanup = null) {
    const listenerId = this.addListener(event, callback, 'react');
    if (!listenerId) return null;

    if (!this.componentListeners.has(componentId)) {
      this.componentListeners.set(componentId, new Set());
    }
    this.componentListeners.get(componentId).add(listenerId);

    if (cleanup) this.cleanupCallbacks.set(listenerId, cleanup);

    return listenerId;
  }

  /* ------------------------------------------------------------------ */
  /* REMOVE LISTENERS                                                    */
  /* ------------------------------------------------------------------ */

  removeListener(event, callback) {
    const listenerId = this.listenerIds.get(callback);
    if (!listenerId) return false;

    this.listeners.get(event)?.delete(callback);
    this.socketListeners.get(event)?.delete(callback);

    this.listenerIds.delete(callback);
    this.eventSources.delete(listenerId);

    const cleanup = this.cleanupCallbacks.get(listenerId);
    if (cleanup) cleanup();
    this.cleanupCallbacks.delete(listenerId);

    for (const [compId, ids] of this.componentListeners.entries()) {
      if (ids.has(listenerId)) {
        ids.delete(listenerId);
        if (ids.size === 0) this.componentListeners.delete(compId);
      }
    }

    this.stats.totalListeners--;
    this.stats.cleanedUp++;

    return true;
  }

  removeListenerById(listenerId) {
    for (const [callback, id] of this.listenerIds.entries()) {
      if (id === listenerId) {
        const info = this.eventSources.get(listenerId);
        return this.removeListener(info.event, callback);
      }
    }
    return false;
  }

  removeAllListeners() {
    let removed = 0;
    for (const event of this.listeners.keys()) {
      for (const cb of Array.from(this.listeners.get(event))) {
        if (this.removeListener(event, cb)) removed++;
      }
    }
    return removed;
  }

  /* ------------------------------------------------------------------ */
  /* REQUIRED FIX — getListeners()                                       */
  /* ------------------------------------------------------------------ */

  /**
   * 🔥 REQUIRED by WebSocketService.emit()
   * This FIXES: "getListeners is not a function"
   */
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
        source: info?.source || 'unknown',
        functionName: callback.name || 'anonymous',
        addedAt: info?.addedAt,
        options: info?.options
      };
    });
  }

  /* ------------------------------------------------------------------ */
  /* HELPERS                                                             */
  /* ------------------------------------------------------------------ */

  hasExactDuplicate(event, callback) {
    return this.listeners.get(event)?.has(callback) || false;
  }

  getStats() {
    return {
      ...this.stats,
      activeEvents: this.listeners.size,
      socketEvents: this.socketListeners.size,
      components: this.componentListeners.size
    };
  }

  cleanup() {
    this.removeAllListeners();
    this.listeners.clear();
    this.socketListeners.clear();
    this.listenerIds.clear();
    this.eventSources.clear();
    this.cleanupCallbacks.clear();
    this.componentListeners.clear();
    this.nextListenerId = 0;
  }
}

export default ListenerManager;
