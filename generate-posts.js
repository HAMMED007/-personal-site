const fs = require('fs');
const path = require('path');

// Simple Markdown to HTML parser
function parseMarkdown(markdown) {
  if (!markdown) return '';
  
  // Inline replacements: Bold, Italics, Code, Links
  let html = markdown
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  const lines = html.split('\n');
  let result = [];
  let currentParagraph = [];
  let inList = false;

  function closeParagraph() {
    if (currentParagraph.length > 0) {
      result.push(`<p>${currentParagraph.join(' ')}</p>`);
      currentParagraph = [];
    }
  }

  function closeList() {
    if (inList) {
      result.push('</ul>');
      inList = false;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    // Horizontal rule
    if (line === '---' || line === '***') {
      closeParagraph();
      closeList();
      result.push('<hr>');
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      closeParagraph();
      closeList();
      result.push(`<h1>${line.substring(2)}</h1>`);
      continue;
    }
    if (line.startsWith('## ')) {
      closeParagraph();
      closeList();
      result.push(`<h2>${line.substring(3)}</h2>`);
      continue;
    }
    if (line.startsWith('### ')) {
      closeParagraph();
      closeList();
      result.push(`<h3>${line.substring(4)}</h3>`);
      continue;
    }

    // Lists
    if (line.startsWith('- ') || line.startsWith('* ')) {
      closeParagraph();
      if (!inList) {
        result.push('<ul>');
        inList = true;
      }
      result.push(`<li>${line.substring(2)}</li>`);
      continue;
    }

    // Empty line splits paragraphs
    if (line === '') {
      closeParagraph();
      closeList();
      continue;
    }

    // Normal text line
    closeList();
    currentParagraph.push(line);
  }

  closeParagraph();
  closeList();

  return result.join('\n');
}

// Convert publication month to an ISO date string
function getPublishDateISO(dateStr) {
  const parts = dateStr.split(' ');
  const monthNames = {
    "January": "01", "February": "02", "March": "03", "April": "04",
    "May": "05", "June": "06", "July": "07", "August": "08",
    "September": "09", "October": "10", "November": "11", "December": "12"
  };
  
  if (parts.length === 2) {
    const month = monthNames[parts[0]] || "01";
    const year = parts[1];
    return `${year}-${month}-15`;
  }
  return '2026-01-15';
}

function generate() {
  const blogJsonPath = path.join(__dirname, 'content', 'blog.json');
  const templatePath = path.join(__dirname, 'post.html');
  const postsDir = path.join(__dirname, 'posts');

  // Check files exist
  if (!fs.existsSync(blogJsonPath)) {
    console.error("Error: content/blog.json not found.");
    process.exit(1);
  }
  if (!fs.existsSync(templatePath)) {
    console.error("Error: post.html template not found.");
    process.exit(1);
  }

  // Create posts directory if it doesn't exist
  if (!fs.existsSync(postsDir)) {
    fs.mkdirSync(postsDir, { recursive: true });
  }

  // Read blog database
  const blogData = JSON.parse(fs.readFileSync(blogJsonPath, 'utf8'));
  const posts = blogData.posts || [];
  
  // Read template HTML
  const templateHtml = fs.readFileSync(templatePath, 'utf8');

  console.log(`Generating ${posts.length} static blog posts...`);

  posts.forEach(post => {
    const compiledBody = parseMarkdown(post.body);
    const isoDate = getPublishDateISO(post.date);

    // Build specific SEO Meta tags
    const seoMeta = `
  <title>${post.title} - Hammed Afenifere</title>
  <meta name="description" content="${post.excerpt}">
  <meta name="author" content="Hammed Afenifere">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://www.hammed.ca/posts/${post.id}.html">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:title" content="${post.title}">
  <meta property="og:description" content="${post.excerpt}">
  <meta property="og:url" content="https://www.hammed.ca/posts/${post.id}.html">
  <meta property="og:image" content="https://www.hammed.ca/og-image.jpg">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${post.title}">
  <meta name="twitter:description" content="${post.excerpt}">
  <meta name="twitter:image" content="https://www.hammed.ca/og-image.jpg">

  <!-- Article JSON-LD Structured Data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": "${post.title.replace(/"/g, '\\"')}",
    "description": "${post.excerpt.replace(/"/g, '\\"')}",
    "datePublished": "${isoDate}",
    "author": {
      "@type": "Person",
      "name": "Hammed Afenifere",
      "url": "https://www.hammed.ca"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Hammed Afenifere",
      "logo": {
        "@type": "ImageObject",
        "url": "https://www.hammed.ca/favicon.png"
      }
    },
    "mainEntityOfPage": "https://www.hammed.ca/posts/${post.id}.html"
  }
  </script>
    `;

    // Process substitutions in template content
    let postHtml = templateHtml;
    
    // Replace SEO placeholder
    postHtml = postHtml.replace('<!-- SEO_METADATA_PLACEHOLDER -->', seoMeta);
    
    // Replace Date
    postHtml = postHtml.replace(
      /<div class="post-date" id="post-date">.*?<\/div>/,
      `<div class="post-date" id="post-date">${post.date}</div>`
    );

    // Replace Title
    postHtml = postHtml.replace(
      /<h1 class="post-title" id="post-title">.*?<\/h1>/,
      `<h1 class="post-title" id="post-title">${post.title}</h1>`
    );

    // Replace Body
    postHtml = postHtml.replace(
      /<div class="post-body" id="post-body">[\s\S]*?<\/div>/,
      `<div class="post-body" id="post-body">\n          ${compiledBody}\n        </div>`
    );

    // Replace static ID placeholder in script
    postHtml = postHtml.replace(
      '/* STATIC_POST_ID_PLACEHOLDER */',
      `const postId = "${post.id}";`
    );

    // Save output file
    const outputPath = path.join(postsDir, `${post.id}.html`);
    fs.writeFileSync(outputPath, postHtml, 'utf8');
    console.log(`Generated: posts/${post.id}.html`);
  });

  // Generate sitemap.xml dynamically
  const todayStr = new Date().toISOString().split('T')[0];
  const sitemapHeader = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
  const sitemapFooter = `</urlset>\n`;

  const coreUrls = [
    { loc: 'https://www.hammed.ca/', changefreq: 'weekly', priority: '1.0' },
    { loc: 'https://www.hammed.ca/about.html', changefreq: 'monthly', priority: '0.9' },
    { loc: 'https://www.hammed.ca/articles.html', changefreq: 'weekly', priority: '0.9' },
    { loc: 'https://www.hammed.ca/conferences.html', changefreq: 'monthly', priority: '0.8' },
    { loc: 'https://www.hammed.ca/gallery.html', changefreq: 'monthly', priority: '0.7' },
    { loc: 'https://www.hammed.ca/press.html', changefreq: 'monthly', priority: '0.8' },
    { loc: 'https://www.hammed.ca/contact.html', changefreq: 'yearly', priority: '0.6' }
  ];

  let sitemapBody = '';
  
  // Add core static files
  coreUrls.forEach(url => {
    sitemapBody += `
  <url>
    <loc>${url.loc}</loc>
    <lastmod>${todayStr}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`;
  });

  // Add individual dynamic blog posts to sitemap
  posts.forEach(post => {
    const postLoc = `https://www.hammed.ca/posts/${post.id}.html`;
    const postDate = getPublishDateISO(post.date);
    sitemapBody += `
  <url>
    <loc>${postLoc}</loc>
    <lastmod>${postDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
  });

  const fullSitemap = sitemapHeader + sitemapBody + '\n' + sitemapFooter;
  fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), fullSitemap, 'utf8');
  console.log("Dynamically generated sitemap.xml containing all core pages and dynamic posts.");
}

generate();
