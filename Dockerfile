FROM node:22-alpine

WORKDIR /app

# Copia package.json y patches antes de instalar dependencias
COPY package*.json ./
COPY patches ./patches

# Instala dependencias de producción y aplica el patch automáticamente
RUN npm install --production

# Copia el resto del código
COPY . .

# Expone el puerto
EXPOSE 5111

# Ejecuta la aplicación
CMD ["node", "index.js"]
