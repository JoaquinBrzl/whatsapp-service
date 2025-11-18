import { chatbotFlow } from '../../chatbot/chatbotFlow.js';
import logger from '../../utils/logger.js';

// Maneja los mensajes entrantes de un usuario
export function handleIncomingMessage(manager, userId, text) {
    // Obtiene la conversación existente o crea una nueva
    let conv = manager.conversations.get(userId) || { step: 'start', lastInteraction: Date.now(), timeout: null };

    // Si había un timeout anterior, lo cancela
    if (conv.timeout) clearTimeout(conv.timeout);

    // Obtiene el paso actual del flujo del chatbot
    const currentStep = chatbotFlow[conv.step];
    if (!currentStep) return 'Error: Paso inválido.';

    // Limpia el texto recibido
    const option = text.trim();
    if (currentStep.next[option]) { // Si la opción existe en el flujo del chatbot
        const nextStep = currentStep.next[option];
        const nextFlow = chatbotFlow[nextStep];

        // Si el siguiente paso es el cierre de conversación
        if (nextStep === 'cierre') {
            manager.socket.sendMessage(userId, { text: nextFlow.message });
            manager.conversations.delete(userId);
            return;
        }

        // Si es un paso final (sin más opciones)
        if (Object.keys(nextFlow.next).length === 0) {
            manager.socket.sendMessage(userId, { text: nextFlow.message });

            // Envía un mensaje final y termina la conversación
            setTimeout(() => {
                manager.socket.sendMessage(userId, { text: '✅ Gracias por tu interés...' });
                manager.conversations.delete(userId);
            }, 1500);

            return nextFlow.message;
        }

        // Crea timeout por inactividad del usuario
        conv.timeout = setTimeout(() => {
            manager.socket.sendMessage(userId, { text: '⌛ Como no interactuaste...' });
            manager.conversations.delete(userId);
        }, 60000);

        // Guarda el avance al siguiente paso
        manager.conversations.set(userId, { ...conv, step: nextStep });
        return nextFlow.message;
    }

    // Si la opción enviada no es válida, mantiene el paso actual
    manager.conversations.set(userId, conv);
    return `❌ Opción no válida.\n\n${currentStep.message}`;
}

// Configura los handlers para recibir mensajes
export function setupMessageHandlers(manager) {
    // Escucha el evento de mensajes entrantes
    manager.socket.ev.on('messages.upsert', async ({ messages }) => {

        const msg = messages[0];

        // Ignora mensajes de grupos, broadcast o enviados por el mismo bot
        if (
            msg.key.remoteJid.includes('@g.us') ||
            msg.key.remoteJid.includes('@broadcast') ||
            !msg.message ||
            msg.key.fromMe
        ) return;

        // Ignora si el mensaje no contiene texto
        if (!msg.message.conversation && !msg.message.extendedTextMessage) return;

        // Extrae el texto del mensaje
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const userId = msg.key.remoteJid;

        // Procesa el mensaje y obtiene respuesta
        const response = handleIncomingMessage(manager, userId, text);

        // Envía la respuesta si existe
        if (response) await manager.socket.sendMessage(userId, { text: response });
    });
}