const cron = require('node-cron');
const { checkAndNotify } = require('./notifications');

let scheduledTask = null;

/**
 * Start the daily scheduler.
 * Runs every day at the configured hour (default 8:00 AM).
 * Also runs once immediately on start (with a 10s delay to let the server warm up).
 */
function startScheduler() {
  stopScheduler(); // Ensure no duplicate tasks

  // Run daily at 8:00 AM
  scheduledTask = cron.schedule('0 8 * * *', async () => {
    console.log('[Scheduler] Revisión diaria de renovaciones...');
    try {
      const result = await checkAndNotify();
      if (result.sent > 0 || result.errors > 0) {
        console.log(`[Scheduler] ${result.message}`);
      }
    } catch (err) {
      console.error('[Scheduler] Error:', err.message);
    }
  });

  // Run an initial check after server starts (delayed 15s)
  setTimeout(async () => {
    console.log('[Scheduler] Verificación inicial...');
    try {
      const result = await checkAndNotify();
      const logMsg = result.sent > 0 ? result.message : (result.errors > 0 ? result.message : 'Sin alertas pendientes');
      console.log(`[Scheduler] ${logMsg}`);
    } catch (err) {
      console.error('[Scheduler] Error inicial:', err.message);
    }
  }, 15000);

  console.log('[Scheduler] Programado: diario a las 8:00 AM');
}

function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}

module.exports = { startScheduler, stopScheduler };
