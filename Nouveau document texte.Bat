@echo off
netsh advfirewall firewall add rule name="NodeJS 7897" dir=in action=allow protocol=TCP localport=7897
netsh advfirewall firewall add rule name="NodeJS 7897 Out" dir=out action=allow protocol=TCP localport=7897
echo ✅ Port 7897 ouvert pour Node.js !
pause