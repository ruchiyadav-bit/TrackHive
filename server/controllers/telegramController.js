const Setting = require('../models/Setting');
const { sendTelegramMessage } = require('../utils/telegram');

// Get Telegram settings
exports.getSettings = async (req, res, next) => {
  try {
    const [botToken, chatId, enabled, alertTypes] = await Promise.all([
      Setting.getValue('telegramBotToken', ''),
      Setting.getValue('telegramChatId', ''),
      Setting.getValue('telegramEnabled', false),
      Setting.getValue('telegramAlertTypes', []),
    ]);

    res.json({
      settings: {
        botToken: botToken ? '••••••' + botToken.slice(-6) : '',
        chatId: chatId || '',
        enabled: !!enabled,
        alertTypes: alertTypes || [],
        isConfigured: !!(botToken && chatId),
      },
    });
  } catch (err) {
    next(err);
  }
};

// Save Telegram settings
exports.saveSettings = async (req, res, next) => {
  try {
    const { botToken, chatId, enabled, alertTypes } = req.body;

    const updates = [];
    if (botToken !== undefined && botToken !== '' && !botToken.startsWith('••')) {
      updates.push(Setting.setValue('telegramBotToken', botToken));
    }
    if (chatId !== undefined) {
      updates.push(Setting.setValue('telegramChatId', chatId));
    }
    if (enabled !== undefined) {
      updates.push(Setting.setValue('telegramEnabled', enabled));
    }
    if (alertTypes !== undefined) {
      updates.push(Setting.setValue('telegramAlertTypes', alertTypes));
    }

    await Promise.all(updates);
    res.json({ success: true, message: 'Telegram settings saved' });
  } catch (err) {
    next(err);
  }
};

// Test Telegram connection
exports.testConnection = async (req, res, next) => {
  try {
    const { botToken, chatId } = req.body;

    // Use provided values or fall back to saved settings
    const token = (botToken && !botToken.startsWith('••'))
      ? botToken
      : await Setting.getValue('telegramBotToken');
    const chat = chatId || await Setting.getValue('telegramChatId');

    if (!token || !chat) {
      return res.status(400).json({ error: 'Bot token and chat ID are required' });
    }

    const result = await sendTelegramMessage(
      '🔔 *TrackHive connected successfully!*\n\nYou will receive alerts here when enabled.',
      { botToken: token, chatId: chat }
    );

    if (result.success) {
      res.json({ success: true, message: 'Test message sent successfully' });
    } else {
      res.status(400).json({ error: result.error || 'Failed to send test message' });
    }
  } catch (err) {
    next(err);
  }
};
