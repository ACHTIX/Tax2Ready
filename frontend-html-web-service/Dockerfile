# Start from the official Nginx image
FROM nginx:latest

# Set the author label
LABEL maintainer="tipsukanya.n@ku.th"

# Google Cloud Run expects containers to listen on port 8080
EXPOSE 8080

# Copy Nginx configuration file optimized for Cloud Run
COPY nginx.conf /etc/nginx/nginx.conf

# Remove the default Nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy our website content into the container
COPY ./ /usr/share/nginx/html/
