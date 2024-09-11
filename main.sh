#!/usr/bin/env bash

# Log file path
LOG_FILE="pnp-scraper.log"

# Log function to add timestamps
log_message() {
    echo "$(date +'%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

log_message "Starting PNP Scraper with VPN connection."

# Define VPN credentials and options
PREFERRED_REGION="ca_vancouver"
VPN_PROTOCOL="wireguard"

# Connect to PIA VPN using WireGuard
log_message "Attempting connect to PIA VPN (Region: $PREFERRED_REGION, Protocol: $VPN_PROTOCOL)."
sudo PIA_USER=$PIA_USER PIA_PASS=$PIA_PASS \
PIA_PF=false PIA_DNS=true DISABLE_IPV6=yes \
PREFERRED_REGION=$PREFERRED_REGION VPN_PROTOCOL=$VPN_PROTOCOL \
./run_setup.sh 2>&1 | tee -a $LOG_FILE

# Log VPN connection execution status
if [ $? -ne 0 ]; then
    log_message "VPN connection failed. Exiting."
    exit 1
else
    log_message "Successfully connected to VPN."
fi

# Run the Node.js scraper script
log_message "Executing the PNP Scraper Notifier (pnp-scraper-notifier.js)."
node pnp-scraper-notifier.js 2>&1 | tee -a $LOG_FILE

# Log scraper script execution status
if [ $? -ne 0 ]; then
    log_message "PNP scraper script failed. Exiting."
else
    log_message "PNP scraper script executed successfully."
fi

# Disconnect from VPN
log_message "Disconnecting from VPN."
wg-quick down pia

# Log VPN disconnection
if [ $? -ne 0 ]; then
    log_message "Failed to disconnect VPN."
else
    log_message "Successfully disconnected from VPN."
fi

# End of the script
log_message "PNP Scraper with VPN connection completed."

