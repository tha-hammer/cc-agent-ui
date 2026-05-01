type ProxyRenderInput = {
  domain: string;
  upstream: string;
};

export function renderCaddyfile({ domain, upstream }: ProxyRenderInput): string {
  return [
    `${domain} {`,
    '  encode zstd gzip',
    `  reverse_proxy ${upstream}`,
    '}',
    '',
  ].join('\n');
}

export function renderNginxServerBlock({ domain, upstream }: ProxyRenderInput): string {
  return [
    'server {',
    '    listen 80;',
    `    server_name ${domain};`,
    '',
    '    location / {',
    `        proxy_pass http://${upstream};`,
    '        proxy_http_version 1.1;',
    '        proxy_set_header Upgrade $http_upgrade;',
    '        proxy_set_header Connection "upgrade";',
    '        proxy_set_header Host $host;',
    '        proxy_set_header X-Real-IP $remote_addr;',
    '        proxy_read_timeout 300s;',
    '    }',
    '}',
    '',
  ].join('\n');
}
