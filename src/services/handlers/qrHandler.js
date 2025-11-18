import QRCode from 'qrcode';
import logger from '../../utils/logger.js';
import { emitQrStatusUpdate } from '../../app.js';
import { generateOptimalQR } from '../utils/qrGenerator.js'; // Importa desde utils

// Genera el QR a partir del string recibido desde la actualización
export async function generateQRFromUpdate(manager, qrString) {
    try {
        // Genera un QR optimizado
        const qrResult = await generateOptimalQR(qrString);

        // Guarda los datos del QR en el manager
        manager.qrData = {
            image: qrResult.image,
            expiresAt: Date.now() + 120000, // QR válido por 2 minutos
            createdAt: new Date().toISOString(),
            qrString,
            ...qrResult
        };

        // Notifica el estado actual del QR
        emitQrStatusUpdate(getQRStatus(manager));

    } catch (error) {
        // Error al generar el QR
        logger.error('Error generating QR', { error: error.message });
    }
}

// Devuelve el estado actual del QR y la conexión del bot
export function getQRStatus(manager) {
    const now = Date.now();

    // Verifica si el QR sigue siendo válido
    const hasActiveQR = !!manager.qrData && now < manager.qrData.expiresAt;

    let qrInfo = null;

    // Si hay un QR guardado, calcula su tiempo restante y edad
    if (manager.qrData) {
        const timeRemaining = Math.floor((manager.qrData.expiresAt - now) / 1000);
        qrInfo = {
            ...manager.qrData,
            timeRemaining: timeRemaining > 0 ? timeRemaining : 0,
            isExpired: timeRemaining <= 0,
            age: Math.floor((now - new Date(manager.qrData.createdAt).getTime()) / 1000)
        };
    }

    // Retorna todo el estado del QR y conexión
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