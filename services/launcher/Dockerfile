FROM docker:28-cli
RUN apk add --no-cache nodejs
WORKDIR /app
COPY services/launcher/main.mjs ./main.mjs
# Compose runs this image under the VM user's numeric UID.
RUN chmod 755 /app && chmod 644 /app/main.mjs
# Override docker:cli's entrypoint so the launcher starts as a Node process.
ENTRYPOINT ["node"]
CMD ["main.mjs"]
