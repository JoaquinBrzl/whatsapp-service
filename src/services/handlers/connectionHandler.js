import logger from '../../utils/logger.js';
import { getWhatsAppConfig } from '../../config/whatsapp.config.js';
import { generateQRFromUpdate } from './qrHandler.js';

export function setupConnectionHandlers(manager) {
    manager.socket.ev.on('connection.update', (update) => {
        try {
            if (update.connection === 'connecting') {
                manager.connectionStatus = 'connecting';
                manager.isConnecting = true;
                manager.reconnectAttempts = 0;
                manager.lastConnectionAttempt = Date.now();
            } else if (update.connection === 'open') {
                manager.connectionStatus = 'connected';
                manager.isConnecting = false;
                manager.qrData = null;
                manager.reconnectAttempts = 0;
                manager.isReconnecting = false;
                logger.info('WhatsApp connected successfully');
            } else if (update.connection === 'close') {
                manager.connectionStatus = 'disconnected';
                manager.isConnecting = false;
                handleDisconnection(manager, update);
            }

            if (update.qr) {
                generateQRFromUpdate(manager, update.qr);
            }
        } catch (error) {
            logger.error('Error in connection update', { error: error.message });
        }
    });
}

function handleDisconnection(manager, update) {
    logger.warn('Connection closed', { reason: update.lastDisconnect?.error?.message });
    if (update.lastDisconnect?.error?.data?.attrs?.code === '515' ||
        update.lastDisconnect?.error?.message?.includes('Stream Errored')) {
        attemptReconnect(manager);
    }
}

export async function attemptReconnect(manager) {
    if (manager.isReconnecting || manager.reconnectAttempts >= manager.maxReconnectAttempts) return;
    manager.isReconnecting = true;
    manager.reconnectAttempts++;
    setTimeout(async () => {
        try {
            await manager.cleanup();
            await manager.initialize();
            manager.reconnectAttempts = 0;
            manager.isReconnecting = false;
        } catch (error) {
            logger.error('Reconnection failed', { error: error.message });
            manager.isReconnecting = false;
            if (manager.reconnectAttempts < manager.maxReconnectAttempts) attemptReconnect(manager);
        }
    }, 3000 * Math.pow(2, manager.reconnectAttempts - 1)); // Backoff exponencial
}