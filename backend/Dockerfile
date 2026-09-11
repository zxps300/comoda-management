FROM php:8.2-cli

# Install dependencies and MySQL support
RUN apt-get update && apt-get install -y \
    libzip-dev \
    zip \
    unzip \
    && docker-php-ext-install pdo pdo_mysql zip

WORKDIR /app

# Copy backend files
COPY . .

# Install Composer
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
RUN composer install --no-dev --optimize-autoloader

# Set permissions for Laravel storage & database
RUN chmod -R 777 storage bootstrap/cache

RUN cp .env.example .env
RUN php artisan key:generate

ENV PORT=10000
EXPOSE 10000

CMD ["sh", "-c", "php artisan migrate --force && php -S 0.0.0.0:10000 router.php"]
