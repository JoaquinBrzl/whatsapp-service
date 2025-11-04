import { getTemplate } from './src/templates.js';
import { makeWASocket, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import express from 'express';
import cors from 'cors';
import https from 'https';

const whatsappRouter = express.Router();
whatsappRouter.use(cors());
whatsappRouter.use(express.json());

let sock;
let isConnected = false;
let lastKnownError = null;

// La función de conexión se mantiene igual
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('Escanea este QR con WhatsApp:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      lastKnownError = lastDisconnect?.error?.output || lastDisconnect?.error;

      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Conexión cerrada. Reconectando...', shouldReconnect);
      if (shouldReconnect) {
        connectToWhatsApp();
      }
      isConnected = false;
    } else if (connection === 'open') {
      console.log('¡Conectado a WhatsApp!');
      isConnected = true;
      lastKnownError = null;
    }
  });

  sock.ev.on('creds.update', saveCreds);
}

// Endpoint de estado
whatsappRouter.get('/status', (req, res) => {
  res.json({
    connected: isConnected,
    lastError: lastKnownError,
    timestamp: new Date().toISOString()
  });
});

// Endpoint de diagnóstico de red
whatsappRouter.get('/check-network', (req, res) => {
  https.get('https://www.google.com', (response) => {
    if (response.statusCode === 200) {
      return res.json({
        network: 'OK',
        message: 'Conectividad saliente a Google (443) exitosa.'
      });
    }
  }).on('error', (err) => {
    return res.status(500).json({
      network: 'FAILED',
      error: err.code,
      message: 'Fallo de conectividad saliente. Revise Firewall de Hostinger.'
    });
  });
});

// API endpoint para enviar mensajes
whatsappRouter.post('/send-message', async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(503).json({
        success: false,
        message: 'WhatsApp no está conectado'
      });
    }

    const { phone, templateOption, psicologo, fecha, hora } = req.body;

    if (!phone || !templateOption) {
      return res.status(400).json({
        success: false,
        message: 'Teléfono o plantilla no proporcionado'
      });
    }

    let formattedPhone = phone.replace(/[^\d]/g, '');
    if (formattedPhone.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'El número de teléfono debe estar en formato internacional, ej: +51987654321'
      });
    }
    formattedPhone += '@s.whatsapp.net';

    const plantilla = getTemplate(templateOption, { nombrePsicologo: psicologo, fecha, hora });

    const result = await sock.sendMessage(formattedPhone, { text: plantilla });

    res.json({
      success: true,
      message: 'Mensaje enviado correctamente',
      messageId: result.key.id
    });

  } catch (error) {
    console.error('Error enviando mensaje:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

export { whatsappRouter, connectToWhatsApp };
