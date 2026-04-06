FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json* /app/
RUN npm ci || npm install

COPY . /app

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

