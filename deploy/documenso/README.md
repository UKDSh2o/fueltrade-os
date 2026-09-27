# FuelTrade signing service deployment

This bundle runs Documenso Community Edition v2.16.0, PostgreSQL and Caddy on a Docker-capable Linux VPS. It is prepared for deployment but has not been run on the owner's VPS. Review official [Documenso self-hosting requirements](https://docs.documenso.com/docs/self-hosting/getting-started/requirements) and [production deployment guide](https://docs.documenso.com/docs/self-hosting/deployment/docker-compose) before operating it.

## Prerequisites

- A VPS with Docker Engine and Compose, at least 2 CPU cores, 2 GB RAM and 20 GB storage for production.
- A chosen signing subdomain with DNS A/AAAA record pointed to that VPS; inbound ports 80 and 443 open for Caddy TLS.
- SMTP host, port, username, password and verified From address for invitations.
- A signing certificate. A self-signed certificate is free and useful for testing, but the certificate identity and trust level for actual agreements are a business/legal choice. Keep the private key, `.p12` and password out of GitHub.

## On the VPS

1. Copy this folder to a private path. Copy `.env.example` to `.env` and set `chmod 600 .env`.
2. Generate independent random secrets *on the VPS* with `openssl rand -hex 32`. Use hex for the database password because it is embedded in a connection URL. Fill in the SMTP fields and domain.
3. Put the approved `.p12` at `private/cert.p12`, readable by container UID 1001 (`chown 1001:1001 private/cert.p12; chmod 400 private/cert.p12`), and set its passphrase in `.env`. Documenso's [certificate instructions](https://docs.documenso.com/docs/self-hosting/configuration/signing-certificate/local) show how to create a test certificate.
4. Run `docker compose --env-file .env config --quiet`, then `docker compose --env-file .env up -d`. Check `docker compose ps` and `https://<signing-domain>/api/health`. Keep Postgres and Documenso ports private; only the proxy publishes ports.
5. Create the first account, verify SMTP delivery, then set `DISABLE_SIGNUP=true` in `.env` and recreate the app. Create a team API token in Documenso. Configure `DOCUMENSO_URL=https://<signing-domain>` and `DOCUMENSO_API_TOKEN` as *FuelTrade Sites runtime secrets*. Do not paste tokens into a chat, issue, or repository.
6. Test with a harmless PDF and an approved recipient, verify completion and downloaded signed PDF in FuelTrade OS. Establish regular PostgreSQL and certificate backups before storing real agreements.

Before the VPS or a domain is selected, there is no public service to test. Do not use the FuelTrade Site's Cloudflare Worker as a replacement for Documenso's PostgreSQL, SMTP and signing-certificate services.
