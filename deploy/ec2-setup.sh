#!/bin/bash
# EC2 Deployment Script for BuilderAI (Lovable Clone)
# This script sets up a fresh EC2 instance to run the application

set -e  # Exit on error

echo "=========================================="
echo "BuilderAI EC2 Deployment Script"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  log_error "Please run as root or with sudo"
  exit 1
fi

# Configuration
APP_USER="${APP_USER:-builderai}"
APP_DIR="/home/${APP_USER}/app"
NODE_VERSION="20"
APP_PORT="${APP_PORT:-3000}"

# Step 1: Update system
log_info "Updating system packages..."
apt-get update && apt-get upgrade -y

# Step 2: Install essential packages
log_info "Installing essential packages..."
apt-get install -y curl wget git nginx certbot python3-certbot-nginx ufw htop

# Step 3: Install Node.js
log_info "Installing Node.js ${NODE_VERSION}..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs

# Verify Node.js installation
node --version
npm --version

# Step 4: Create application user
log_info "Creating application user: ${APP_USER}..."
if ! id "${APP_USER}" &>/dev/null; then
  useradd -m -s /bin/bash "${APP_USER}"
fi

# Step 5: Clone or update application
log_info "Setting up application directory..."
mkdir -p "${APP_DIR}"
chown -R "${APP_USER}:${APP_USER}" "/home/${APP_USER}"

# Step 6: Install PM2 globally
log_info "Installing PM2 process manager..."
npm install -g pm2

# Step 7: Configure UFW firewall
log_info "Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# Step 8: Create systemd service for the app
log_info "Creating systemd service..."
cat > /etc/systemd/system/builderai.service << 'EOF'
[Unit]
Description=BuilderAI Next.js Application
After=network.target

[Service]
Type=simple
User=builderai
WorkingDirectory=/home/builderai/app/apps/web
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Step 9: Configure Nginx
log_info "Configuring Nginx..."
cat > /etc/nginx/sites-available/builderai << 'EOF'
server {
    listen 80;
    server_name _;  # Replace with your domain

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/builderai /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
nginx -t && systemctl reload nginx

# Step 10: Create deployment helper script
log_info "Creating deployment helper script..."
cat > /home/${APP_USER}/deploy.sh << 'EOF'
#!/bin/bash
# Deployment helper script - run this to deploy/update the app

set -e

APP_DIR="/home/builderai/app"
cd "$APP_DIR"

echo "Pulling latest changes..."
git pull origin main

echo "Installing dependencies..."
npm install

echo "Building application..."
npm run build

echo "Restarting application..."
sudo systemctl restart builderai

echo "Deployment complete!"
echo "Check status: sudo systemctl status builderai"
echo "View logs: sudo journalctl -u builderai -f"
EOF

chmod +x /home/${APP_USER}/deploy.sh
chown ${APP_USER}:${APP_USER} /home/${APP_USER}/deploy.sh

# Step 11: Create environment file template
log_info "Creating environment file template..."
cat > /home/${APP_USER}/app/.env.local.template << 'EOF'
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Anthropic API Key (for AI features)
ANTHROPIC_API_KEY=your-anthropic-api-key

# Application Configuration
NEXT_PUBLIC_APP_URL=https://your-domain.com
NODE_ENV=production
EOF

chown ${APP_USER}:${APP_USER} /home/${APP_USER}/app/.env.local.template

# Step 12: Setup PM2 startup
log_info "Setting up PM2 startup..."
pm2 startup systemd -u ${APP_USER} --hp /home/${APP_USER}

# Reload systemd
systemctl daemon-reload

echo ""
echo "=========================================="
echo "EC2 Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Clone your repository to ${APP_DIR}:"
echo "   sudo -u ${APP_USER} git clone <your-repo-url> ${APP_DIR}"
echo ""
echo "2. Copy and configure environment variables:"
echo "   sudo -u ${APP_USER} cp ${APP_DIR}/.env.local.template ${APP_DIR}/apps/web/.env.local"
echo "   sudo -u ${APP_USER} nano ${APP_DIR}/apps/web/.env.local"
echo ""
echo "3. Install dependencies and build:"
echo "   cd ${APP_DIR}"
echo "   sudo -u ${APP_USER} npm install"
echo "   sudo -u ${APP_USER} npm run build"
echo ""
echo "4. Start the application:"
echo "   sudo systemctl start builderai"
echo "   sudo systemctl enable builderai"
echo ""
echo "5. (Optional) Set up SSL with Let's Encrypt:"
echo "   sudo certbot --nginx -d your-domain.com"
echo ""
echo "Useful commands:"
echo "  View logs: sudo journalctl -u builderai -f"
echo "  Restart:   sudo systemctl restart builderai"
echo "  Status:    sudo systemctl status builderai"
echo ""
