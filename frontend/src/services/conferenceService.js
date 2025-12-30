/**
 * Conference Service
 * 
 * Handles conference session management via REST API
 */

import apiClient from './apiClient.js';

class ConferenceService {
  /**
   * Create a new conference session
   * @param {Object} sessionData - Session data
   * @returns {Promise<Object>} Created session
   */
  static async createSession(sessionData) {
    try {
      console.log('Creating session with data:', sessionData);
      const response = await apiClient.post('/conference/create', sessionData);
      console.log('Session created successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to create session:', error);
      console.error('Error response:', error.response);
      console.error('Error status:', error.response?.status);
      console.error('Error data:', error.response?.data);
      
      if (error.response?.status === 400) {
        console.error('Bad Request details:', error.response.data);
        throw new Error(error.response.data.message || error.response.data.errors || 'Invalid request data');
      }
      
      throw new Error(error.response?.data?.message || 'Failed to create session');
    }
  }

  /**
   * Join an existing conference session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Session details
   */
  static async joinSession(sessionId) {
    try {
      const response = await apiClient.post(`/conference/join/${sessionId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to join session:', error);
      throw new Error(error.response?.data?.message || 'Failed to join session');
    }
  }

  /**
   * Leave a conference session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Response
   */
  static async leaveSession(sessionId) {
    try {
      const response = await apiClient.post(`/conference/leave/${sessionId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to leave session:', error);
      throw new Error(error.response?.data?.message || 'Failed to leave session');
    }
  }

  /**
   * Get session details
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Session details
   */
  static async getSession(sessionId) {
    try {
      const response = await apiClient.get(`/conference/session/${sessionId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get session:', error);
      throw new Error(error.response?.data?.message || 'Failed to get session');
    }
  }

  /**
   * Get user's hosted sessions
   * @returns {Promise<Array>} List of user's sessions
   */
  static async getUserSessions() {
    try {
      const response = await apiClient.get('/conference/my-sessions');
      return response.data;
    } catch (error) {
      console.error('Failed to get user sessions:', error);
      throw new Error(error.response?.data?.message || 'Failed to get user sessions');
    }
  }
}

export default ConferenceService;
