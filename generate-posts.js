const fs = require('fs');
const path = require('path');

// Recursive helper functions to copy files and directories
function copyFileSync(source, target) {
  let targetFile = target;
  if (fs.existsSync(target) && fs.lstatSync(target).isDirectory()) {
    targetFile = path.join(target, path.basename(source));
  }
  fs.writeFileSync(targetFile, fs.readFileSync(source));
}

function copyFolderRecursiveSync(source, target) {
  const targetFolder = path.join(target, path.basename(source));
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  if (fs.lstatSync(source).isDirectory()) {
    const files = fs.readdirSync(source);
    files.forEach(file => {
      const curSource = path.join(source, file);
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursiveSync(curSource, targetFolder);
      } else {
        copyFileSync(curSource, targetFolder);
      }
    });
  }
}

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
  const distDir = path.join(__dirname, 'dist');
  
  // 1. Clean and create output directory (dist)
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  console.log("Preparing build artifacts in dist/...");

  // 2. Copy static files to dist
  const staticFiles = [
    'index.html',
    'about.html',
    'articles.html',
    'conferences.html',
    'contact.html',
    'gallery.html',
    'press.html',
    'post.html', // Raw template page preserved
    'style.css',
    'robots.txt',
    'favicon.png',
    'og-image.jpg'
  ];

  staticFiles.forEach(file => {
    const srcPath = path.join(__dirname, file);
    if (fs.existsSync(srcPath)) {
      copyFileSync(srcPath, distDir);
    }
  });

  // 3. Copy directories to dist
  const staticDirs = ['admin', 'content'];
  staticDirs.forEach(dir => {
    const srcPath = path.join(__dirname, dir);
    if (fs.existsSync(srcPath)) {
      // Note: copyFolderRecursiveSync copies the directory inside the target dir, so it creates dist/admin and dist/content
      copyFolderRecursiveSync(srcPath, distDir);
    }
  });

  // Paths relative to dist for post generation
  const blogJsonPath = path.join(distDir, 'content', 'blog.json');
  const templatePath = path.join(distDir, 'post.html');
  const postsDir = path.join(distDir, 'posts');

  if (!fs.existsSync(blogJsonPath)) {
    console.error("Error: dist/content/blog.json not found.");
    process.exit(1);
  }
  if (!fs.existsSync(templatePath)) {
    console.error("Error: dist/post.html template not found.");
    process.exit(1);
  }

  // Create dist/posts directory
  fs.mkdirSync(postsDir, { recursive: true });

  // Read blog database
  const blogData = JSON.parse(fs.readFileSync(blogJsonPath, 'utf8'));
  const posts = blogData.posts || [];
  
  // Read template HTML
  const templateHtml = fs.readFileSync(templatePath, 'utf8');

  console.log(`Generating ${posts.length} static blog posts in dist/posts/ ...`);

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
    postHtml = postHtml.replace('<!-- SEO_METADATA_PLACEHOLDER -->', seoMeta);
    
    postHtml = postHtml.replace(
      /<div class="post-date" id="post-date">.*?<\/div>/,
      `<div class="post-date" id="post-date">${post.date}</div>`
    );

    postHtml = postHtml.replace(
      /<h1 class="post-title" id="post-title">.*?<\/h1>/,
      `<h1 class="post-title" id="post-title">${post.title}</h1>`
    );

    postHtml = postHtml.replace(
      /<div class="post-body" id="post-body">[\s\S]*?<\/div>/,
      `<div class="post-body" id="post-body">\n          ${compiledBody}\n        </div>`
    );

    postHtml = postHtml.replace(
      '/* STATIC_POST_ID_PLACEHOLDER */',
      `const postId = "${post.id}";`
    );

    // Save output file inside dist/posts/
    const outputPath = path.join(postsDir, `${post.id}.html`);
    fs.writeFileSync(outputPath, postHtml, 'utf8');
  });

  // 4. Generate dist/sitemap.xml dynamically
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
  
  coreUrls.forEach(url => {
    sitemapBody += `
  <url>
    <loc>${url.loc}</loc>
    <lastmod>${todayStr}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`;
  });

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
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), fullSitemap, 'utf8');
  console.log("Successfully compiled all assets and generated sitemap.xml in dist/.");
}

generate();
