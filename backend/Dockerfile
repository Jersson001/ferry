FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

# Después del build a propósito: con NODE_ENV=production, `npm install`
# omitiría las devDependencies que necesita `nest build`.
ENV NODE_ENV=production

EXPOSE 3000

ENTRYPOINT []
# node directo y no `npm run start:prod`: npm no reenvía bien SIGTERM y,
# cuando Render duerme o reemplaza la instancia, lo registra como
# "npm error ... signal SIGTERM" aunque el apagado sea normal.
CMD ["node", "dist/main"]
