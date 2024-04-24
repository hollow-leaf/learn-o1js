FROM node:18.18.2-alpine3.18

WORKDIR /app

RUN npm install -g pnpm@8.6.10

COPY ./protokit ./

COPY ./src/CH3 ./packages/chain

COPY ./src/CH4 ./packages/chain

RUN pnpm install

EXPOSE 3000 8080

CMD ["pnpm", "test"]