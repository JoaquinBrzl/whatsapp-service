import { makeWASocket, useMultiFileAuthState } from '@whiskeysockets/baileys';
import logger from '../utils/logger.js';
import { getWhatsAppConfig } from '../config/whatsapp.config.js';
import { setupConnectionHandlers, attemptReconnect } from './handlers/connectionHandler.js';
import { setupMessageHandlers } from './handlers/messageHandler.js';
import { getQRStatus } from './handlers/qrHandler.js';
import { getImageBase64 } from './utils/imageUtils.js';
import { generateOptimalQR } from './utils/qrGenerator.js';
import { getTemplate, getTemplateMessage } from '../templates.js';

class WhatsAppManager {
    constructor() {
        this.socket = null;
        this.qrData = null;
        this.isConnecting = false;
        this.connectionStatus = 'disconnected';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectTimer = null;
        this.isReconnecting = false;
        this.lastConnectionAttempt = 0;
        this.conversations = new Map();
        this.sentMessages = [];
        this.userConnections = new Map();
    }

    async initialize() {
        try {
            const { state, saveCreds } = await useMultiFileAuthState('auth_info');
            const config = getWhatsAppConfig();

            this.socket = makeWASocket({
                auth: state,
                printQRInTerminal: config.security?.printQRInTerminal || false,
                connectTimeoutMs: config.stability?.connectionTimeout || 30000,
                browser: ['Chrome', '120.0.0.0', 'Windows'],
                keepAliveIntervalMs: 60000,
                markOnlineOnConnect: true,
                syncFullHistory: false,
                retryRequestDelayMs: 1000,
                maxRetries: 5,
                emitOwnEvents: false,
                shouldIgnoreJid: (jid) => jid.includes('@broadcast'),
                patchMessageBeforeSending: (msg) => {
                    if (msg.message) msg.messageTimestamp = Date.now();
                    return msg;
                },
                ws: {
                    timeout: 30000,
                    keepalive: true,
                    keepaliveInterval: 15000,
                }
            });

            this.socket.ev.on('creds.update', saveCreds);
            setupConnectionHandlers(this);
            setupMessageHandlers(this);

            logger.info('WhatsApp Manager initialized');
        } catch (error) {
            logger.error('Error initializing WhatsApp Manager', { error: error.message });
            throw error;
        }
    }

    async cleanup() {
        if (this.socket) {
            this.socket.ev.removeAllListeners();
            await this.socket.end();
        }
        this.socket = null;
        this.qrData = null;
        this.isConnecting = false;
        this.connectionStatus = 'disconnected';
        this.isReconnecting = false;
    }

    // Métodos públicos
    async requestQR(userId) {
        if (this.isConnecting || this.isReconnecting) {
            throw { code: 'CONNECTION_IN_PROGRESS', message: 'Ya se está intentando conectar.' };
        }
        try {
            if (this.connectionStatus === 'connected') {
                return { success: false, message: 'Ya estás conectado.' };
            }
            if (this.qrData && Date.now() < this.qrData.expiresAt) {
                throw { code: 'QR_ACTIVE', message: 'Ya hay un QR activo', expiresAt: this.qrData.expiresAt };
            }
            const now = Date.now();
            const userHistory = this.userConnections.get(userId) || [];
            if (userHistory.filter(t => now - t < 3600000).length >= 100) {
                throw { code: 'RATE_LIMITED', message: 'Límite alcanzado', resetTime: userHistory[0] + 3600000 };
            }
            this.isConnecting = true;
            this.connectionStatus = 'connecting';
            await this.cleanup();
            await this.initialize();
            this.userConnections.set(userId, [...userHistory, now].slice(-10));
            return { success: true, message: 'Solicitud procesada.' };
        } catch (error) {
            if (error.code !== 'CONNECTION_IN_PROGRESS') {
                this.isConnecting = false;
                this.connectionStatus = 'disconnected';
            }
            throw error;
        }
    }

    async expireQR(reason, userId) {
        logger.info('Expiring QR code', { reason, userId });
        if (this.qrData) {
            this.qrData.expiresAt = Date.now();
            this.updateQrStatus();
            return true;
        }
        return false;
    }

    getQRStatus() {
        return getQRStatus(this);
    }

    async sendMessage({ telefono, templateOption, nombre, fecha, hora, productoName }) {
        if (!this.socket?.user) throw new Error('No conectado.');
        const cleanPhone = telefono.replace(/\D/g, '');
        if (!/^\d{10,15}$/.test(cleanPhone)) throw new Error('Número inválido');
        const formattedPhone = `${cleanPhone}@s.whatsapp.net`;
        const plantilla = getTemplate(templateOption, { nombre, fecha, hora, productoName });
        if (!plantilla?.text) throw new Error('Plantilla inválida');
        let messagePayload = { text: plantilla.text };
        if (plantilla.image) {
            const imageBuffer = await getImageBase64(plantilla.image);
            if (!imageBuffer) throw new Error(`Imagen no encontrada: ${plantilla.image}`);
            messagePayload = { image: imageBuffer, caption: plantilla.text };
        }
        const result = await this.socket.sendMessage(formattedPhone, messagePayload);
        const sentMessage = {
            telefono: formattedPhone,
            template: templateOption,
            nombre, fecha, hora,
            messageId: result.key.id,
            sentAt: new Date().toISOString(),
            messagePreview: plantilla.text.substring(0, 100) + (plantilla.text.length > 100 ? '...' : ''),
            status: 'sent',
            hasImage: !!plantilla.image
        };
        this.sentMessages.push(sentMessage);
        const config = getWhatsAppConfig();
        if (this.sentMessages.length > (config.messages?.maxHistorySize || 100)) {
            this.sentMessages = this.sentMessages.slice(-(config.messages?.maxHistorySize || 100));
        }
        return { success: true, messageId: result.key.id, telefono: formattedPhone, sentAt: new Date().toISOString(), messagePreview: sentMessage.messagePreview };
    }

    async sendMessageImageDashboard({ telefono, templateOption, nombre, fecha, hora, image }) {
        if (!this.socket?.user) {
            throw new Error("No conectado a WhatsApp. Por favor, escanea el código QR primero.");
        }

        console.log('imagedash', image); // Mantén para debugging

        const cleanPhone = telefono.replace(/\D/g, "");
        if (cleanPhone.length < 10 || cleanPhone.length > 15) {
            throw new Error("El número de teléfono debe tener entre 10 y 15 dígitos");
        }

        const formattedPhone = `${cleanPhone}@s.whatsapp.net`;

        // Obtiene la plantilla
        const plantilla = getTemplateMessage(templateOption, { nombre, fecha, hora, image });

        if (!plantilla || !plantilla.text || !plantilla.image) {
            throw new Error("Plantilla de mensaje no válida o falta imagen");
        }

        // Descargar imagen como base64
        const imageBase64 = await getImageBase64(plantilla.image);
        if (!imageBase64) {
            logger.warn('No se pudo descargar la imagen, no se enviará ningún mensaje', { telefono: formattedPhone });
            return { success: false, message: "No se envió mensaje por error de imagen" };
        }

        try {
            logger.info("Enviando mensaje WhatsApp con imagen", {
                telefono: formattedPhone,
                template: templateOption,
                nombre,
                fecha,
                hora,
                imageUrl: plantilla.image
            });

            const messagePayload = {
                image: imageBase64,
                caption: plantilla.text
            };

            const result = await this.sendMessageImageWithRetry(formattedPhone, messagePayload, 3);

            logger.info("Mensaje enviado exitosamente", {
                telefono: formattedPhone,
                messageId: result.key.id,
                timestamp: new Date().toISOString(),
            });

            const sentMessage = {
                telefono: formattedPhone,
                template: templateOption,
                nombre,
                fecha,
                hora,
                messageId: result.key.id,
                sentAt: new Date().toISOString(),
                messagePreview: plantilla.text.substring(0, 100) + (plantilla.text.length > 100 ? "..." : ""),
                status: "sent",
                type: "image",
                imageSize: imageBase64.length
            };

            this.sentMessages.push(sentMessage);

            const config = getWhatsAppConfig();
            if (this.sentMessages.length > (config.messages?.maxHistorySize || 100)) {
                this.sentMessages = this.sentMessages.slice(
                    -(config.messages?.maxHistorySize || 100)
                );
            }

            return {
                success: true,
                messageId: result.key.id,
                telefono: formattedPhone,
                template: templateOption,
                sentAt: new Date().toISOString(),
                messagePreview: sentMessage.messagePreview
            };
        } catch (error) {
            logger.error('Fallo al enviar mensaje con imagen, no se enviará nada', { telefono: formattedPhone, error: error.message });
            return { success: false, message: "Error al enviar imagen, no se envió mensaje" };
        }
    }

    async sendMessageWithImage({ imageData, phone, caption }) {
        if (!this.socket?.user) {
            throw new Error('No conectado a WhatsApp. Por favor, escanea el código QR primero.');
        }

        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length < 10 || cleanPhone.length > 15) {
            throw new Error('El número de teléfono debe tener entre 10 y 15 dígitos');
        }

        const formattedPhone = `${cleanPhone}@s.whatsapp.net`;

        // Validar datos de imagen
        if (!imageData) {
            throw new Error('Los datos de la imagen son requeridos');
        }

        let imageBuffer;
        try {
            // Remover prefijo data:image si existe
            const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
            imageBuffer = Buffer.from(base64Data, 'base64');

            // Validar tamaño de imagen (máximo 16MB para WhatsApp)
            const maxSize = 16 * 1024 * 1024; // 16MB
            if (imageBuffer.length > maxSize) {
                throw new Error('La imagen es demasiado grande. El tamaño máximo es 16MB');
            }
        } catch (error) {
            throw new Error('Formato de imagen base64 inválido');
        }

        try {
            const captionText = caption || 'Imagen enviada';
            logger.info('Enviando mensaje con imagen WhatsApp', {
                phone: formattedPhone,
                imageSize: imageBuffer.length,
                captionLength: captionText.length
            });

            // Preparar mensaje con imagen
            const messageOptions = {
                image: imageBuffer,
                caption: captionText,
                jpegThumbnail: null,
            };

            const result = await this.socket.sendMessage(formattedPhone, messageOptions);

            logger.info('Mensaje enviado exitosamente', {
                phone: formattedPhone,
                messageId: result.key.id,
                timestamp: new Date().toISOString()
            });

            const sentMessage = {
                phone: formattedPhone,
                messageId: result.key.id,
                sentAt: new Date().toISOString(),
                messagePreview: captionText.substring(0, 100) + (captionText.length > 100 ? '...' : ''),
                type: 'image',
                imageSize: imageBuffer.length,
                status: 'sent'
            };

            this.sentMessages.push(sentMessage);

            const config = getWhatsAppConfig();
            if (this.sentMessages.length > (config.messages?.maxHistorySize || 100)) {
                this.sentMessages = this.sentMessages.slice(-(config.messages?.maxHistorySize || 100));
            }

            return {
                success: true,
                messageId: result.key.id,
                phone: formattedPhone,
                sentAt: new Date().toISOString(),
                messagePreview: captionText.substring(0, 100) + (captionText.length > 100 ? '...' : ''),
                type: 'image',
                imageSize: imageBuffer.length
            };

        } catch (error) {
            logger.error('Error enviando mensaje WhatsApp', {
                phone: formattedPhone,
                error: error.message,
                stack: error.stack
            });

            if (error.message.includes('disconnected')) {
                await this.cleanup();  // Método de instancia
                throw new Error('Conexión perdida con WhatsApp. Por favor, escanea el código QR nuevamente.');
            }

            if (error.message.includes('not-authorized')) {
                throw new Error('No tienes autorización para enviar mensajes a este número.');
            }

            if (error.message.includes('forbidden')) {
                throw new Error('No se puede enviar mensajes a este número. Verifica que el número sea válido.');
            }

            if (error.message.includes('rate limit')) {
                throw new Error('Límite de mensajes alcanzado. Espera un momento antes de enviar más mensajes.');
            }

            throw new Error(`Error al enviar mensaje: ${error.message}`);
        }
    }

    async sendMessageImageWithRetry(jid, content, maxRetries = 3) {
        let lastError;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                logger.debug(`Intento ${attempt} de envío de mensaje`, { jid, attempt, maxRetries });
                const result = await this.socket.sendMessage(jid, content);
                if (result) {
                    logger.debug('Mensaje enviado exitosamente', { jid, attempt, messageId: result.key?.id });
                    return result;
                }
            } catch (error) {
                lastError = error;
                logger.warn(`Error en intento ${attempt}`, { jid, attempt, maxRetries, error: error.message });
                if (attempt === maxRetries) break;
                const delay = Math.pow(2, attempt - 1) * 1000;
                logger.debug(`Esperando ${delay}ms antes del siguiente intento`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        throw lastError || new Error('Error desconocido al enviar mensaje');
    }

    async sendMessageWithRetry(phone, messageText, maxRetries = null) {
        const config = getWhatsAppConfig();
        const retries = maxRetries || config.messages?.maxRetries || 3;
        let lastError;

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const result = await this.socket.sendMessage(phone, {
                    text: messageText,
                    timestamp: Date.now()
                });
                return result;
            } catch (error) {
                lastError = error;
                logger.warn(`Intento ${attempt} fallido al enviar mensaje`, {
                    phone,
                    error: error.message,
                    attempt
                });

                if (attempt < retries) {
                    const delay = Math.min((config.messages?.retryDelay || 2000) * Math.pow(2, attempt - 1), 5000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError;
    }

    getQrCode() {
        const now = Date.now();

        if (!this.qrData || now >= this.qrData.expiresAt) {
            return null;
        }

        const timeRemaining = Math.floor((this.qrData.expiresAt - now) / 1000);

        return {
            ...this.qrData,
            timeRemaining,
            timeRemainingFormatted: `${Math.floor(timeRemaining / 60)}:${(timeRemaining % 60).toString().padStart(2, '0')}`,
            percentageRemaining: Math.round((timeRemaining / 60) * 100),
            isExpired: false,
            age: Math.floor((now - new Date(this.qrData.createdAt).getTime()) / 1000)
        };
    }

    updateQrStatus() {
        const status = this.getQRStatus();
        emitQrStatusUpdate(status);
    }

    getSentMessages() {
        return this.sentMessages.slice().reverse();
    }

    clearSentMessages() {
        this.sentMessages = [];
        logger.info('Historial de mensajes enviados limpiado');
        return true;
    }

    async forceReconnect() {
        logger.info('Forcing manual reconnection');
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        await attemptReconnect(this);
    }

    getReconnectionStatus() {
        return {
            isReconnecting: this.isReconnecting,
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts,
            lastConnectionAttempt: this.lastConnectionAttempt
        };
    }

    async generateQRInFormat(qrString, format = 'PNG') {
        try {
            const qrResult = await generateOptimalQR(qrString, format);
            logger.info('QR generated in specific format', {
                format: qrResult.format,
                size: qrResult.size,
                mimeType: qrResult.mimeType
            });
            return qrResult;
        } catch (error) {
            logger.error('Error generating QR in specific format', { error: error.message, format });
            throw error;
        }
    }

    getQRFormatInfo() {
        if (!this.qrData) {
            return null;
        }

        return {
            format: this.qrData.format,
            size: this.qrData.size,
            mimeType: this.qrData.mimeType,
            fallback: this.qrData.fallback || false,
            createdAt: this.qrData.createdAt,
            expiresAt: this.qrData.expiresAt
        };
    }

    async changeQRFormat(format) {
        try {
            if (!this.qrData?.qrString) {
                throw new Error('No hay QR activo para cambiar formato');
            }

            const qrResult = await generateOptimalQR(this.qrData.qrString, format);

            // Actualizar el QR existente con el nuevo formato
            this.qrData = {
                ...this.qrData,
                image: qrResult.image,
                format: qrResult.format,
                size: qrResult.size,
                mimeType: qrResult.mimeType,
                fallback: qrResult.fallback || false
            };

            // Emitir actualización
            try {
                this.updateQrStatus();  // Método de instancia que emite el estado actualizado
            } catch (emitError) {
                logger.error('Error emitting QR format change', { error: emitError.message });
            }

            logger.info('QR format changed successfully', {
                newFormat: qrResult.format,
                size: qrResult.size,
                mimeType: qrResult.mimeType
            });

            return qrResult;
        } catch (error) {
            logger.error('Error changing QR format', { error: error.message, format });
            throw error;
        }
    }

    async sendSimpleMessage({ phone, message, type, useTemplate = false }) {
        if (!this.socket?.user) {
            throw new Error('No conectado a WhatsApp. Por favor, escanea el código QR primero.');
        }

        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length < 10 || cleanPhone.length > 15) {
            throw new Error('El número de teléfono debe tener entre 10 y 15 dígitos');
        }

        const formattedPhone = `${cleanPhone}@s.whatsapp.net`;

        // Importar las funciones de template
        const { getAcceptanceTemplate, getRejectionTemplate } = await import('../templates.js');

        let finalMessage = message;

        // Si se debe usar template, aplicar el correspondiente según el tipo
        if (useTemplate) {
            if (type === 'accept') {
                finalMessage = getAcceptanceTemplate(message);
            } else if (type === 'reject') {
                finalMessage = getRejectionTemplate(message);
            }
        }

        try {
            logger.info('Enviando mensaje simple WhatsApp', {
                phone: formattedPhone,
                type: type,
                useTemplate: useTemplate,
                messageLength: finalMessage.length
            });

            const result = await this.sendMessageWithRetry(formattedPhone, finalMessage);

            logger.info('Mensaje simple enviado exitosamente', {
                phone: formattedPhone,
                type: type,
                useTemplate: useTemplate,
                messageId: result.key.id,
                timestamp: new Date().toISOString()
            });

            const sentMessage = {
                phone: formattedPhone,
                type: type,
                message: message, // Guardar el comentario original
                finalMessage: finalMessage, // Guardar el mensaje final con template
                useTemplate: useTemplate,
                messageId: result.key.id,
                sentAt: new Date().toISOString(),
                messagePreview: finalMessage.substring(0, 100) + (finalMessage.length > 100 ? '...' : ''),
                status: 'sent'
            };

            this.sentMessages.push(sentMessage);

            const config = getWhatsAppConfig();
            if (this.sentMessages.length > (config.messages?.maxHistorySize || 100)) {
                this.sentMessages = this.sentMessages.slice(-(config.messages?.maxHistorySize || 100));
            }

            return {
                success: true,
                messageId: result.key.id,
                phone: formattedPhone,
                type: type,
                useTemplate: useTemplate,
                sentAt: new Date().toISOString(),
                messagePreview: finalMessage.substring(0, 100) + (finalMessage.length > 100 ? '...' : ''),
                originalComment: message
            };

        } catch (error) {
            logger.error('Error enviando mensaje simple WhatsApp', {
                phone: formattedPhone,
                type: type,
                useTemplate: useTemplate,
                error: error.message,
                stack: error.stack
            });

            if (error.message.includes('disconnected')) {
                await this.cleanup();  // Método de instancia
                throw new Error('Conexión perdida con WhatsApp. Por favor, escanea el código QR nuevamente.');
            }

            if (error.message.includes('not-authorized')) {
                throw new Error('No tienes autorización para enviar mensajes a este número.');
            }

            if (error.message.includes('forbidden')) {
                throw new Error('No se puede enviar mensajes a este número. Verifica que el número sea válido.');
            }

            if (error.message.includes('rate limit')) {
                throw new Error('Límite de mensajes alcanzado. Espera un momento antes de enviar más mensajes.');
            }

            throw new Error(`Error al enviar mensaje: ${error.message}`);
        }
    }
}

export default new WhatsAppManager();

export async function startWhatsAppBot() {
    await WhatsAppManager.initialize();
}