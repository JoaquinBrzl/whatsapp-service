import QRCode from 'qrcode';
import logger from '../../utils/logger.js';

export async function generateOptimalQR(qrString, format = 'PNG') {
    try {
        let qrImage;
        let qrConfig;

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

        qrImage = await QRCode.toDataURL(qrString, qrConfig);

        return {
            image: qrImage,
            format: format.toUpperCase(),
            mimeType: qrConfig.type,
            size: `${qrConfig.width}x${qrConfig.width}`,
            config: qrConfig
        };

    } catch (error) {
        logger.error('Error generating optimal QR', { error: error.message, format });
        try {
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
            throw new Error(`Failed to generate QR in any format: ${error.message}`);
        }
    }
}