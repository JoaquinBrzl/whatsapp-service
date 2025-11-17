import fs from 'fs';
import path from 'path';
import logger from '../../utils/logger.js';

export async function getImageBase64(imgPath) {
    try {
        const baseUrl = process.env.BASE_URL;
        if (imgPath.startsWith(`${baseUrl}/public/`)) {
            const relativePath = imgPath.replace(`${baseUrl}/public/`, '');
            const fullPath = path.resolve(process.cwd(), 'src', 'public', relativePath);
            logger.info('Leyendo imagen localmente desde BASE_URL', { imgPath, fullPath, baseUrl });
            return await fs.promises.readFile(fullPath);
        } else if (imgPath.startsWith("http")) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            const response = await fetch(imgPath, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP ${response.status} al descargar ${imgPath}`);
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        } else {
            const fullPath = path.resolve(process.cwd(), 'src', 'public', imgPath);
            logger.info('Leyendo imagen localmente desde ruta relativa', { imgPath, fullPath });
            return await fs.promises.readFile(fullPath);
        }
    } catch (error) {
        console.error(`Error obteniendo imagen desde ${imgPath}:`, error.message);
        return null;
    }
}