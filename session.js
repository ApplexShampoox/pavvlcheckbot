const LocalSession = require('telegraf-session-local');

module.exports = new LocalSession({ database: 'session_db.json' });