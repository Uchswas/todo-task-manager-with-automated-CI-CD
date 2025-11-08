FROM node:18-alpine

WORKDIR /app

# Install frontend deps
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# React dev server listens here
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
