<?php
// Production 404 responder for www.teutasteel.com.
//
// The host replaces native ErrorDocument responses with its own page, so unknown
// paths are rewritten here by .htaccess. This returns a real HTTP 404 status and
// the site's own branded page - not the SPA shell, and not a host error page.
//
// It differs from tools/staging-404.php in one way: no X-Robots-Tag header. A 404
// page should not carry an indexing instruction, and production is indexable.
//
// No input is read, reflected or executed here.
http_response_code(404);
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');

$page = __DIR__ . '/404.html';
if (is_readable($page)) {
    readfile($page);
    return;
}

// The branded page was not packaged; still answer with a real, minimal 404.
echo '<!doctype html><html lang="sq"><head><meta charset="utf-8">'
   . '<meta name="viewport" content="width=device-width, initial-scale=1">'
   . '<title>404 - Teuta Steel</title></head><body style="font:18px/1.6 Arial,sans-serif;'
   . 'background:#f8fafc;color:#17212b;padding:8vw"><h1>Faqja nuk u gjet / Page not found</h1>'
   . '<p><a href="/">www.teutasteel.com</a></p></body></html>';
