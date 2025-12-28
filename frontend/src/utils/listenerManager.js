/**
 * ListenerManager - Production-grade event listener management with duplicate prevention
 * Prevents memory leaks and duplicate listeners in WebSocket and React components
 */

class ListenerManager {
  constructor() {
    this.listeners = new Map(); // event -> Set(callbacks)
    this.socketListeners = new Map(); // event -> Set(callbacks) 
    this.listenerIds = new Map(); // callback -> uniqueId
    this.nextListenerId = 0;
    this.eventSources = new Map(); // listenerId -> source info
    this.duplicateAttempts = new Map(); // event -> Set(callbacks already attempted)
    
    // Cleanup tracking
    this.cleanupCallbacks = new Map(); // listenerId -> cleanup function
    this.componentListeners = new Map(); // componentId -> Set(listenerIds)
    
    // Statistics
    this.stats = {
      totalListeners: 0,
      duplicatePrevented: 0,
      cleanedUp: 0,
      socketListeners: 0,
      componentListeners: 0
    };
    
    // Debug mode
    this.debugMode = process.env.NODE_ENV === 'development';
  }

  /**
   * Add listener with duplicate prevention
   * @param {string} event - Event name
   * @param {Function} callback - Event callback function
   * @param {string} source - Source identifier ('websocket', 'react', 'custom')
   * @param {Object} options - Additional options
   * @returns {string|null} Listener ID or null if duplicate prevented
   */
  addListener(event, callback, source = 'custom', options = {}) {
    const listenerId = `listener_${this.nextListenerId++}`;
    
    // Check for exact duplicates (same function reference)
    if (this.hasExactDuplicate(event, callback)) {
      if (this.debugMode) {
        console.warn(`🛡️ Exact duplicate listener prevented for event: ${event}`, {
          listenerId,
          source,
          functionName: callback.name || 'anonymous'
        });
      }
      this.stats.duplicatePrevented++;
      return null;
    }
    
    // Check for similar listeners (same function name and event)
    if (this.hasSimilarListener(event, callback)) {
      if (this.debugMode) {
        console.warn(`🛡️ Similar listener prevented for event: ${event}`, {
          listenerId,
          source,
          functionName: callback.name || 'anonymous',
          reason: 'similar_function_name'
        });
      }
      this.stats.duplicatePrevented++;
      return null;
    }
    
    // Store listener info
    this.listenerIds.set(callback, listenerId);
    this.eventSources.set(listenerId, {
      event,
      source,
      addedAt: Date.now(),
      functionName: callback.name || 'anonymous',
      options
    });
    
    // Add to appropriate listener set
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    
    // Track source-specific listeners
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
      console.log(`✅ Listener added: ${event} (${source})`, {
        listenerId,
        functionName: callback.name || 'anonymous',
        totalListeners: this.stats.totalListeners
      });
    }
    
    return listenerId;
  }

  /**
   * Remove specific listener
   * @param {string} event - Event name
   * @param {Function} callback - Event callback function
   * @returns {boolean} Whether listener was removed
   */
  removeListener(event, callback) {
    const listenerId = this.listenerIds.get(callback);
    const sourceInfo = this.eventSources.get(listenerId);
    
    if (!listenerId) {
      if (this.debugMode) {
        console.warn(`🛡️ Listener not found for removal: ${event}`, {
          functionName: callback.name || 'anonymous'
        });
      }
      return false;
    }
    
    // Remove from all tracking maps
    this.listeners.get(event)?.delete(callback);
    this.socketListeners.get(event)?.delete(callback);
    this.listenerIds.delete(callback);
    this.eventSources.delete(listenerId);
    
    // Call cleanup function if exists
    const cleanup = this.cleanupCallbacks.get(listenerId);
    if (cleanup) {
      try {
        cleanup();
        this.cleanupCallbacks.delete(listenerId);
      } catch (error) {
        console.error('Error in listener cleanup:', error);
      }
    }
    
    // Remove from component tracking
    for (const [componentId, listenerIds] of this.componentListeners.entries()) {
      if (listenerIds.has(listenerId)) {
        listenerIds.delete(listenerId);
        if (listenerIds.size === 0) {
          this.componentListeners.delete(componentId);
        }
        break;
      }
    }
    
    this.stats.totalListeners--;
    this.stats.cleanedUp++;
    
    if (this.debugMode) {
      console.log(`🗑️ Listener removed: ${event}`, {
        listenerId,
        source: sourceInfo?.source,
        functionName: callback.name || 'anonymous',
        remainingListeners: this.stats.totalListeners
      });
    }
    
    return true;
  }

  /**
   * Remove listener by ID
   * @param {string} listenerId - Listener ID
   * @returns {boolean} Whether listener was removed
   */
  removeListenerById(listenerId) {
    for (const [callback, id] of this.listenerIds.entries()) {
      if (id === listenerId) {
        const sourceInfo = this.eventSources.get(listenerId);
        return this.removeListener(sourceInfo.event, callback);
      }
    }
    return false;
  }

  /**
   * Add socket listener with duplicate prevention
   * @param {Object} socket - Socket.IO socket instance
   * @param {string} event - Event name
   * @param {Function} callback - Event callback function
   * @param {Object} options - Additional options
   * @returns {string|null} Listener ID or null if duplicate prevented
   */
  addSocketListener(socket, event, callback, options = {}) {
    const listenerId = this.addListener(event, callback, 'websocket', options);
    
    if (listenerId && socket) {
      try {
        socket.on(event, callback);
        
        // Store cleanup function
        this.cleanupCallbacks.set(listenerId, () => {
          try {
            socket.off(event, callback);
          } catch (error) {
            console.error('Error removing socket listener:', error);
          }
        });
        
        if (this.debugMode) {
          console.log(`🔌 Socket listener added: ${event}`, {
            listenerId,
            socketId: socket.id,
            functionName: callback.name || 'anonymous'
          });
        }
        
      } catch (error) {
        console.error('Error adding socket listener:', error);
        this.removeListenerById(listenerId);
        return null;
      }
    }
    
    return listenerId;
  }

  /**
   * Add React component listener with automatic cleanup
   * @param {string} componentId - React component identifier
   * @param {string} event - Event name
   * @param {Function} callback - Event callback function
   * @param {Function} cleanup - Cleanup function for component unmount
   * @param {Object} options - Additional options
   * @returns {string|null} Listener ID or null if duplicate prevented
   */
  addComponentListener(componentId, event, callback, cleanup = null, options = {}) {
    const listenerId = this.addListener(event, callback, 'react', options);
    
    if (listenerId) {
      // Track component listeners
      if (!this.componentListeners.has(componentId)) {
        this.componentListeners.set(componentId, new Set());
      }
      this.componentListeners.get(componentId).add(listenerId);
      
      // Store cleanup function
      if (cleanup) {
        this.cleanupCallbacks.set(listenerId, cleanup);
      }
      
      if (this.debugMode) {
        console.log(`⚛️ Component listener added: ${event}`, {
          listenerId,
          componentId,
          functionName: callback.name || 'anonymous'
        });
      }
    }
    
    return listenerId;
  }

  /**
   * Cleanup all listeners for a component
   * @param {string} componentId - React component identifier
   * @returns {number} Number of listeners cleaned up
   */
  cleanupComponentListeners(componentId) {
    const listenerIds = this.componentListeners.get(componentId);
    if (!listenerIds) return 0;
    
    let cleanedCount = 0;
    
    for (const listenerId of Array.from(listenerIds)) {
      if (this.removeListenerById(listenerId)) {
        cleanedCount++;
      }
    }
    
    this.componentListeners.delete(componentId);
    
    if (this.debugMode) {
      console.log(`🧹 Component listeners cleaned up: ${componentId}`, {
        cleanedCount,
        remainingComponents: this.componentListeners.size
      });
    }
    
    return cleanedCount;
  }

  /**
   * Cleanup all listeners for event
   * @param {string} event - Event name
   * @returns {number} Number of listeners cleaned up
   */
  cleanupEventListeners(event) {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return 0;
    
    let cleanedCount = 0;
    
    for (const callback of Array.from(callbacks)) {
      if (this.removeListener(event, callback)) {
        cleanedCount++;
      }
    }
    
    if (this.debugMode) {
      console.log(`🧹 Event listeners cleaned up: ${event}`, {
        cleanedCount
      });
    }
    
    return cleanedCount;
  }

  /**
   * Get listeners for an event
   * @param {string} event - Event name
   * @returns {Array} Array of listener info objects
   */
  getEventListeners(event) {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return [];
    
    return Array.from(callbacks).map(callback => {
      const listenerId = this.listenerIds.get(callback);
      const sourceInfo = this.eventSources.get(listenerId);
      
      return {
        callback,
        listenerId,
        source: sourceInfo?.source,
        functionName: callback.name || 'anonymous',
        addedAt: sourceInfo?.addedAt,
        options: sourceInfo?.options
      };
    });
  }

  /**
   * Get all active listeners
   * @returns {Object} Object with event names as keys and listener arrays as values
   */
  getAllListeners() {
    const allListeners = {};
    
    for (const [event, callbacks] of this.listeners.entries()) {
      allListeners[event] = this.getEventListeners(event);
    }
    
    return allListeners;
  }

  /**
   * Get listener statistics
   * @returns {Object} Listener statistics
   */
  getStats() {
    return {
      ...this.stats,
      uniqueEvents: this.listeners.size,
      socketEvents: this.socketListeners.size,
      activeComponents: this.componentListeners.size,
      cleanupCallbacks: this.cleanupCallbacks.size
    };
  }

  /**
   * Check for exact duplicate listener (same function reference)
   * @param {string} event - Event name
   * @param {Function} callback - Event callback function
   * @returns {boolean} Whether exact duplicate exists
   */
  hasExactDuplicate(event, callback) {
    const existingListeners = this.listeners.get(event);
    return existingListeners ? existingListeners.has(callback) : false;
  }

  /**
   * Check for similar listener (same function name and event)
   * @param {string} event - Event name
   * @param {Function} callback - Event callback function
   * @returns {boolean} Whether similar listener exists
   */
  hasSimilarListener(event, callback) {
    const existingListeners = this.listeners.get(event);
    if (!existingListeners) return false;
    
    const callbackName = callback.name || '';
    if (!callbackName) return false; // Anonymous functions can't be similar
    
    for (const existingCallback of existingListeners) {
      const existingName = existingCallback.name || '';
      if (existingName && existingName === callbackName) {
        // Additional check: ensure they're not the same reference
        if (existingCallback !== callback) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Check if listener exists by ID
   * @param {string} listenerId - Listener ID
   * @returns {boolean} Whether listener exists
   */
  hasListener(listenerId) {
    return this.eventSources.has(listenerId);
  }

  /**
   * Get listener info by ID
   * @param {string} listenerId - Listener ID
   * @returns {Object|null} Listener info or null
   */
  getListenerInfo(listenerId) {
    return this.eventSources.get(listenerId) || null;
  }

  /**
   * Remove all listeners (global cleanup)
   * @returns {number} Number of listeners removed
   */
  removeAllListeners() {
    let totalRemoved = 0;
    
    for (const event of Array.from(this.listeners.keys())) {
      totalRemoved += this.cleanupEventListeners(event);
    }
    
    // Clear component tracking
    this.componentListeners.clear();
    
    if (this.debugMode) {
      console.log('🧹 All listeners removed', {
        totalRemoved,
        stats: this.getStats()
      });
    }
    
    return totalRemoved;
  }

  /**
   * Validate listener integrity
   * @returns {Object} Validation results
   */
  validateIntegrity() {
    const issues = [];
    
    // Check for orphaned listener IDs
    for (const [listenerId] of this.eventSources.entries()) {
      if (!this.listenerIds.has(listenerId) && !Array.from(this.listenerIds.values()).includes(listenerId)) {
        issues.push(`Orphaned listener ID: ${listenerId}`);
      }
    }
    
    // Check for missing cleanup callbacks
    for (const [listenerId, cleanup] of this.cleanupCallbacks.entries()) {
      if (typeof cleanup !== 'function') {
        issues.push(`Invalid cleanup for listener: ${listenerId}`);
      }
    }
    
    // Check for inconsistent counts
    const totalTrackedListeners = this.listenerIds.size;
    const totalEventListeners = Array.from(this.listeners.values())
      .reduce((sum, set) => sum + set.size, 0);
    
    if (totalTrackedListeners !== totalEventListeners) {
      issues.push(`Listener count mismatch: tracked=${totalTrackedListeners}, events=${totalEventListeners}`);
    }
    
    return {
      valid: issues.length === 0,
      issues,
      stats: this.getStats()
    };
  }

  /**
   * Export listener data for debugging
   * @returns {Object} Exported listener data
   */
  exportData() {
    return {
      listeners: this.getAllListeners(),
      componentListeners: Object.fromEntries(
        Array.from(this.componentListeners.entries()).map(([id, set]) => [id, Array.from(set)])
      ),
      stats: this.getStats(),
      validation: this.validateIntegrity(),
      timestamp: Date.now()
    };
  }

  /**
   * Enable or disable debug mode
   * @param {boolean} enabled - Whether debug mode should be enabled
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
    console.log(`🔍 ListenerManager debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// Create singleton instance
const listenerManager = new ListenerManager();

export default listenerManager;
