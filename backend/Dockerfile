FROM php:8.2-cli

# Install dependencies and SQLite support
RUN apt-get update && apt-get install -y \
    libzip-dev \
    zip \
    unzip \
    sqlite3 \
    libsqlite3-dev \
    && docker-php-ext-install pdo pdo_sqlite zip

WORKDIR /app

# Copy backend files
COPY . .

# Install Composer
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
RUN composer install --no-dev --optimize-autoloader

# Set permissions for Laravel storage & database
RUN chmod -R 777 storage bootstrap/cache

# Create SQLite database and run setup
RUN touch database/database.sqlite
RUN chmod 777 database/database.sqlite
RUN cp .env.example .env
RUN php artisan key:generate
RUN php artisan migrate --force --seed

EXPOSE 10000

CMD ["sh", "-c", "php -S 0.0.0.0:${PORT:-10000} -t public public/index.php"]
