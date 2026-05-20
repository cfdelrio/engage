# ORKESTAI ENGAGE — DNS & SSL Configuration

## Step 1: Configure DNS Records

### What you need to do (in your domain registrar):

1. Log in to your domain registrar (GoDaddy, Namecheap, NIC.ar, etc.)
2. Navigate to DNS settings for **orkestai.ar**
3. Add/Update the following records:

```
Type   | Name            | Value              | TTL
-------|-----------------|------------------|-------
A      | engage          | 44.223.7.160      | 3600
CNAME  | api.engage      | engage.orkestai.ar| 3600
```

- **engage**: Points to your EC2 instance IP (main subdomain)
- **api.engage**: Alias to engage (optional, for API subdomain routing)

**Expected state after DNS propagation (5-30 mins):**
```bash
nslookup engage.orkestai.ar
# Should return: 44.223.7.160
```

---

## Step 2: Verify DNS on EC2

Once DNS is configured, SSH into EC2 and verify:

```bash
nslookup engage.orkestai.ar
# Should return: 44.223.7.160

curl -I http://engage.orkestai.ar:3000
# Should return 200 OK (currently HTTP, we'll fix with SSL next)
```

---

## Step 3: Install and Configure SSL Certificate

Run the SSL setup script on EC2:

```bash
cd /home/ec2-user/engage
bash infra/scripts/setup-ssl.sh engage.orkestai.ar
```

This script will:
1. Install Certbot (Let's Encrypt client)
2. Obtain a free SSL certificate for engage.orkestai.ar
3. Configure auto-renewal
4. Update systemd services to use HTTPS

**Interactive prompts during setup:**
- Email for certificate renewal notifications
- Agree to Let's Encrypt terms

---

## Step 4: Update Web Service to Use HTTPS

After SSL setup, the web service will be available at:
```
https://engage.orkestai.ar:3000
https://engage.orkestai.ar:3001  (API)
```

**Public URLs** (after systemd restart):
```
Dashboard:  https://engage.orkestai.ar
API:        https://engage.orkestai.ar:3001
Swagger:    https://engage.orkestai.ar:3001/docs
Bull Board: https://engage.orkestai.ar:3002
```

---

## Step 5: Configure Firewall (Security Groups)

In AWS EC2 > Security Groups for your instance:

| Protocol | Port | Source       | Purpose |
|----------|------|------------|---------|
| HTTP     | 80   | 0.0.0.0/0  | Let's Encrypt ACME challenge |
| HTTPS    | 443  | 0.0.0.0/0  | Web dashboard traffic |
| HTTPS    | 3001 | 0.0.0.0/0  | API traffic |
| HTTPS    | 3002 | 0.0.0.0/0  | Bull Board (optional, restrict IP) |
| SSH      | 22   | YOUR_IP/32 | SSH access (restrict to your IP) |

---

## Step 6: Verify Everything

```bash
# Check certificate
sudo certbot certificates

# Check systemd services
sudo systemctl status orkestai-api orkestai-worker orkestai-web

# Test HTTPS endpoints
curl -I https://orkestai.ar
curl -I https://orkestai.ar:3001

# View logs if issues
sudo journalctl -u orkestai-web -f
sudo journalctl -u orkestai-api -f
```

---

## Troubleshooting

### DNS not resolving
```bash
# Clear DNS cache
sudo systemctl restart systemd-resolved

# Or use external DNS
nslookup engage.orkestai.ar 8.8.8.8
```

### Certificate renewal fails
```bash
# Manual renewal
sudo certbot renew --force-renewal

# Check renewal status
sudo certbot renew --dry-run
```

### Port 80/443 already in use
```bash
sudo lsof -i :80
sudo lsof -i :443
sudo kill -9 <PID>
```

### Can't access https://engage.orkestai.ar
```bash
# Check if ports are open in Security Group
aws ec2 describe-security-groups --group-ids sg-xxxxx

# Temporarily test on non-standard port
curl -I http://engage.orkestai.ar:3000
```

---

## Auto-Renewal

Certbot automatically renews certificates 30 days before expiry via:
```bash
sudo systemctl list-timers | grep certbot
```

Logs are in `/var/log/letsencrypt/renewal.log`

---

## Next Steps

1. ✅ Configure DNS in your registrar
2. ✅ Verify DNS resolution
3. ✅ Run `setup-ssl.sh` on EC2
4. ✅ Update Security Groups
5. ✅ Verify HTTPS endpoints
6. 📈 Monitor certificate renewal in logs
