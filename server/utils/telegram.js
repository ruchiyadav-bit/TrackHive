const fetch = require('node-fetch');
const Setting = require('../models/Setting');

/**
 * Send a message via Telegram Bot API
 * @param {string} message - Message text (supports Markdown)
 * @param {object} options - Override botToken and chatId
 */
async function sendTelegramMessage(message, options = {}) {
  try {
    const botToken = options.botToken || await Setting.getValue('telegramBotToken');
    const chatId = options.chatId || await Setting.getValue('telegramChatId');

    if (!botToken || !chatId) {
      return { success: false, error: 'Telegram bot token or chat ID not configured' };
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      return { success: false, error: data.description || 'Telegram API error' };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Format and send a notification as a Telegram alert
 * @param {object} notification - The notification object
 */
async function sendNotificationToTelegram(notification) {
  const telegramEnabled = await Setting.getValue('telegramEnabled', false);
  if (!telegramEnabled) return;

  // Check which alert types are enabled for Telegram
  const alertTypes = await Setting.getValue('telegramAlertTypes', []);
  if (alertTypes.length > 0 && !alertTypes.includes(notification.type)) return;

  const severityEmoji = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '🔴',
    success: '✅',
  };

  const emoji = severityEmoji[notification.severity] || '🔔';

  let message = `🔔 *TrackHive Alert*\n\n`;
  message += `${emoji} *${notification.title}*\n`;
  message += `${notification.message}\n`;

  if (notification.offerName) {
    message += `\n📋 Offer: ${notification.offerName}`;
  }

  if (notification.data) {
    if (notification.data.current !== undefined && notification.data.cap !== undefined) {
      message += `\n📊 Current: ${notification.data.current}/${notification.data.cap}`;
    }
  }

  const timestamp = new Date().toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  message += `\n📅 ${timestamp}`;

  return sendTelegramMessage(message);
}

module.exports = { sendTelegramMessage, sendNotificationToTelegram };
