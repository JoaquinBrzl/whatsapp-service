import QRCode from 'qrcode';
import logger from '../../utils/logger.js';

// Genera un QR optimizado según el formato solicitado (PNG, JPEG o SVG)
export async function generateOptimalQR(qrString, format = 'PNG') {
    try {
        let qrImage;
        let qrConfig;

        // Selecciona configuración según el tipo de formato
        switch (format.toUpperCase()) {
            case 'PNG':
                qrConfig = {
                    type: 'image/png',
                    quality: 0.92,
                    margin: 1,
                    color: { dark: '#000000', light: '#FFFFFF' },
                    width: 256,
                    errorCorrectionLevel: 'M'
                };
                break;
            case 'JPEG':
                qrConfig = {
                    type: 'image/jpeg',
                    quality: 0.9,
                    margin: 1,
                    color: { dark: '#000000', light: '#FFFFFF' },
                    width: 256,
                    errorCorrectionLevel: 'M'
                };
                break;
            case 'SVG':
                qrConfig = {
                    type: 'svg',
                    margin: 1,
                    color: { dark: '#000000', light: '#FFFFFF' },
                    width: 256,
                    errorCorrectionLevel: 'M'
                };
                break;

            // Si el formato no existe, usa PNG por defecto
            default:
                qrConfig = {
                    type: 'image/png',
                    quality: 0.92,
                    margin: 1,
                    color: { dark: '#000000', light: '#FFFFFF' },
                    width: 256,
                    errorCorrectionLevel: 'M'
                };
        }
        
        // Genera el QR final con la configuración seleccionada
        qrImage = await QRCode.toDataURL(qrString, qrConfig);

        // Devuelve la información del QR generado
        return {
            image: qrImage,
            format: format.toUpperCase(),
            mimeType: qrConfig.type,
            size: `${qrConfig.width}x${qrConfig.width}`,
            config: qrConfig
        };

    } catch (error) {
        // Registra el error y genera un QR en formato PNG como respaldo
        logger.error('Error generating optimal QR', { error: error.message, format });

        try {
            // Generación de QR de respaldo en caso de fallo
            const fallbackQR = await QRCode.toDataURL(qrString, {
                type: 'image/png',
                width: 256,
                margin: 1
            });
            return {
                image: fallbackQR,
                format: 'PNG',
                mimeType: 'image/png',
                size: '256x256',
                config: { type: 'image/png', width: 256, margin: 1 },
                fallback: true
            };
        } catch (fallbackError) {
            // Si incluso el QR de respaldo falla, lanza error crítico
            throw new Error(`Failed to generate QR in any format: ${error.message}`);
        }
    }
}