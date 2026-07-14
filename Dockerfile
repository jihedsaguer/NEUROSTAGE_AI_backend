FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

# Install ALL dependencies including devDependencies (nest CLI is a devDependency)
RUN npm ci

COPY . .

# Now nest is available
RUN npm run build

FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./

# Only production deps for the final image
RUN npm ci --only=production

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

RUN mkdir -p /var/neurostage/uploads

EXPOSE 3000
CMD ["node", "dist/src/main.js"]
