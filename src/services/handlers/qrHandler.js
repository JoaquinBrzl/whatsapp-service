import QRCode from 'qrcode';
import logger from '../../utils/logger.js';
import { emitQrStatusUpdate } from '../../app.js';
import { generateOptimalQR } from '../utils/qrGenerator.js'; // Importa desde utils

export async function generateQRFromUpdate(manager, qrString) {
    try {
        const qrResult = await generateOptimalQR(qrString);
        manager.qrData = {
            image: qrResult.image,
            expiresAt: Date.now() + 120000,
            createdAt: new Date().toISOString(),
            qrString,
            ...qrResult
        };
        emitQrStatusUpdate(getQRStatus(manager));
    } catch (error) {
        logger.error('Error generating QR', { error: error.message });
    }
}

export function getQRStatus(manager) {
    const now = Date.now();
    const hasActiveQR = !!manager.qrData && now < manager.qrData.expiresAt;

    let qrInfo = null;
    if (manager.qrData) {
        const timeRemaining = Math.floor((manager.qrData.expiresAt - now) / 1000);
        qrInfo = {
            ...manager.qrData,
            timeRemaining: timeRemaining > 0 ? timeRemaining : 0,
            isExpired: timeRemaining <= 0,
            age: Math.floor((now - new Date(manager.qrData.createdAt).getTime()) / 1000)
        };
    }

    return {
        hasActiveQR,
        qrData: qrInfo,
        isConnected: manager.connectionStatus === 'connected',
        connectionState: {
            isConnecting: manager.isConnecting,
            hasSocket: !!manager.socket,
            socketStatus: manager.connectionStatus,
            status: manager.connectionStatus,
            reconnectAttempts: manager.reconnectAttempts,
            isReconnecting: manager.isReconnecting
        },
        lastUpdated: new Date().toISOString()
    };
}