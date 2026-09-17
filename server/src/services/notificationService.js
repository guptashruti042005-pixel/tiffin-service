/**
 * Notification Service Abstraction for T1 integration
 * Responsible for delivering notification payloads to external communication channels.
 */

class NotificationService {
  constructor() {
    this.sentCount = 0;
  }

  /**
   * Send delivery notification for an active, unpaused customer
   * @param {Object} params 
   * @param {Object} params.customer
   * @param {Object} params.subscription
   * @param {string} params.date YYYY-MM-DD
   * @returns {Promise<{ success: boolean, messageId: string, timestamp: string }>}
   */
  async sendDeliveryNotification({ customer, subscription, date }) {
    this.sentCount++;
    // In production, this would dispatch to SMS/WhatsApp/Push gateway
    const messageId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      success: true,
      messageId,
      recipient: customer.phone,
      message: `Hello ${customer.name}, your tiffin delivery for ${date} is on its way!`,
      timestamp: new Date().toISOString()
    };
  }
}

export const notificationService = new NotificationService();
export default notificationService;
