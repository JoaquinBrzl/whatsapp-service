import logger from '../../utils/logger.js';
import { getWhatsAppConfig } from '../../config/whatsapp.config.js';
import { generateQRFromUpdate } from './qrHandler.js';

export function setupConnectionHandlers(manager) {
    manager.socket.ev.on('connection.update', (update) => {
        try {
            if (update.connection === 'connecting') {// Si está conectando, actualiza estado
                manager.connectionStatus = 'connecting';
                manager.isConnecting = true;
                manager.reconnectAttempts = 0;
                manager.lastConnectionAttempt = Date.now();
            } else if (update.connection === 'open') {// Si se conectó, resetea estado
                manager.connectionStatus = 'connected';
                manager.isConnecting = false;
                manager.qrData = null;
                manager.reconnectAttempts = 0;
                manager.isReconnecting = false;
                logger.info('WhatsApp connected successfully');
            } else if (update.connection === 'close') {// Si se desconectó, maneja la desconexión
                manager.connectionStatus = 'disconnected';
                manager.isConnecting = false;
                handleDisconnection(manager, update);
            }

            // Si hay QR, genera y actualiza
            if (update.qr) {
                generateQRFromUpdate(manager, update.qr);
            }
        } catch (error) {
            logger.error('Error in connection update', { error: error.message });
        }
    });
}

function handleDisconnection(manager, update) {
    // Log de desconexión
    logger.warn('Connection closed', { reason: update.lastDisconnect?.error?.message });

    // Si es error de stream, intenta reconectar
    if (update.lastDisconnect?.error?.data?.attrs?.code === '515' ||
        update.lastDisconnect?.error?.message?.includes('Stream Errored')) {
        attemptReconnect(manager);
    }
}

export async function attemptReconnect(manager) {

    // Evita reconectar si ya está intentando o alcanzó el límite
    if (manager.isReconnecting || manager.reconnectAttempts >= manager.maxReconnectAttempts) return;

    // Marca como reconectando
    manager.isReconnecting = true;
    manager.reconnectAttempts++;

    // Espera y reconecta
    setTimeout(async () => {
        try {
            await manager.cleanup(); // Limpia la sesión actual
            await manager.initialize(); // Inicia una nueva
            manager.reconnectAttempts = 0;
            manager.isReconnecting = false;
        } catch (error) {
            // Falló la reconexión
            logger.error('Reconnection failed', { error: error.message });
            manager.isReconnecting = false;
            // Reintenta si aún no llegó al límite
            if (manager.reconnectAttempts < manager.maxReconnectAttempts) attemptReconnect(manager);
        }
    }, 3000 * Math.pow(2, manager.reconnectAttempts - 1)); // Backoff exponencial
}