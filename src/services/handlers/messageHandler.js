import { chatbotFlow } from '../../chatbot/chatbotFlow.js';
import logger from '../../utils/logger.js';

export function handleIncomingMessage(manager, userId, text) {
    let conv = manager.conversations.get(userId) || { step: 'start', lastInteraction: Date.now(), timeout: null };

    if (conv.timeout) clearTimeout(conv.timeout);

    const currentStep = chatbotFlow[conv.step];
    if (!currentStep) return 'Error: Paso inválido.';

    const option = text.trim();
    if (currentStep.next[option]) {
        const nextStep = currentStep.next[option];
        const nextFlow = chatbotFlow[nextStep];

        if (nextStep === 'cierre') {
            manager.socket.sendMessage(userId, { text: nextFlow.message });
            manager.conversations.delete(userId);
            return;
        }

        if (Object.keys(nextFlow.next).length === 0) {
            manager.socket.sendMessage(userId, { text: nextFlow.message });
            setTimeout(() => {
                manager.socket.sendMessage(userId, { text: '✅ Gracias por tu interés...' });
                manager.conversations.delete(userId);
            }, 1500);
            return nextFlow.message;
        }

        conv.timeout = setTimeout(() => {
            manager.socket.sendMessage(userId, { text: '⌛ Como no interactuaste...' });
            manager.conversations.delete(userId);
        }, 60000);

        manager.conversations.set(userId, { ...conv, step: nextStep });
        return nextFlow.message;
    }

    manager.conversations.set(userId, conv);
    return `❌ Opción no válida.\n\n${currentStep.message}`;
}

export function setupMessageHandlers(manager) {
    manager.socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (msg.key.remoteJid.includes('@g.us') || msg.key.remoteJid.includes('@broadcast') || !msg.message || msg.key.fromMe) return;

        if (!msg.message.conversation && !msg.message.extendedTextMessage) return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const userId = msg.key.remoteJid;
        const response = handleIncomingMessage(manager, userId, text);

        if (response) await manager.socket.sendMessage(userId, { text: response });
    });
}