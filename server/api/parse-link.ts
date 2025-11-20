interface ParsedLinkData {
  url: string;
  title: string;
  description: string | null;
  image: string | null;
  siteName: string | null;
  platform: string;
  favicon: string;
  suggestedTags: string[];
}

export default defineEventHandler(async (event): Promise<ParsedLinkData> => {
  const body = await readBody(event);
  const { url, useProxy } = body;

  if (!url) {
    throw createError({
      statusCode: 400,
      message: "URL is required",
    });
  }

  try {
    // Validate URL format
    const urlObj = new URL(url);

    // Check if this is a known restricted site
    const isRestrictedSite = [
      "facebook.com",
      "instagram.com",
      "linkedin.com",
      "twitter.com",
      "x.com",
    ].some((domain) => urlObj.hostname.includes(domain));

    let html: string;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      // For restricted sites, use official bot user-agents
      if (isRestrictedSite) {
        // Try different whitelisted bot user-agents
        const botUserAgents = [
          "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
          "Twitterbot/1.0",
          "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
          "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
        ];

        // Try the first bot user-agent
        const response = await fetch(url, {
          headers: {
            "User-Agent": botUserAgents[0]!, // Use Facebook's bot first
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
          },
          redirect: "follow",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(
            `Failed to fetch URL (${response.status} ${response.statusText})`
          );
        }

        html = await response.text();
      } else {
        // For non-restricted sites, use standard browser headers
        const response = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
          redirect: "follow",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(
            `Failed to fetch URL (${response.status} ${response.statusText})`
          );
        }

        html = await response.text();
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }

    // Extract metadata using regex patterns
    let title =
      extractMetaTag(html, "og:title") ||
      extractMetaTag(html, "twitter:title") ||
      extractTitle(html);

    let description =
      extractMetaTag(html, "og:description") ||
      extractMetaTag(html, "twitter:description") ||
      extractMetaTag(html, "description");

    const image =
      extractMetaTag(html, "og:image") || extractMetaTag(html, "twitter:image");

    // For social media sites, the title contains the full post content
    const isSocialMedia = [
      "facebook.com",
      "instagram.com",
      "twitter.com",
      "x.com",
      "tiktok.com",
      "linkedin.com",
    ].some((domain) => urlObj.hostname.includes(domain));

    let aiTags: string[] = [];

    if (isSocialMedia && title) {
      // For social media: Extract additional content from the page
      // Try to get more text content beyond just the title
      const fullContent = extractFullTextContent(html, title);

      // Use AI to generate a concise title and description, plus tags
      try {
        const aiResult = await generateTitleDescriptionAndTags(fullContent, url);
        title = aiResult.title || title;
        description = aiResult.description || description;
        aiTags = aiResult.tags;
      } catch (aiError) {
        console.error("Failed to generate AI content:", aiError);
        // Fallback: use truncated title as description
        description = title.length > 200 ? title.substring(0, 197) + "..." : title;
      }
    } else {
      // For non-social media: standard handling
      // Check if title is poor quality (too long, generic, or missing)
      const needsBetterTitle =
        !title ||
        title === "Untitled" ||
        title.length > 100 ||
        title.toLowerCase().includes("untitled");

      // Generate better title and AI tags using OpenAI
      if (description) {
        try {
          const aiResult = await generateTitleAndTagsWithAI(description, url, title);
          // Only use AI title if current title is poor quality
          if (needsBetterTitle && aiResult.title) {
            title = aiResult.title;
          }
          // Always use AI tags if available
          aiTags = aiResult.tags;
        } catch (aiError) {
          console.error("Failed to generate AI title and tags:", aiError);
        }
      }
    }

    // Generate tags from URL/title patterns
    const patternTags = generateTags(url, title, urlObj.hostname);

    // Merge AI tags with pattern tags, prioritizing AI tags
    const allTags = [...new Set([...aiTags, ...patternTags])].slice(0, 5);

    const metadata = {
      url,
      title,
      description,
      image,
      siteName: extractMetaTag(html, "og:site_name"),
      platform: getPlatform(urlObj.hostname),
      favicon: `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`,
      suggestedTags: allTags,
    };

    return metadata;
  } catch (error) {
    // If fetch fails, return basic metadata from URL
    const urlObj = new URL(url);
    return getFallbackMetadata(url, urlObj);
  }
});

// Generate title, description, and tags for social media posts
async function generateTitleDescriptionAndTags(
  postContent: string,
  url: string
): Promise<{ title: string | null; description: string | null; tags: string[] }> {
  const config = useRuntimeConfig();
  const apiKey = config.openaiApiKey;

  if (!apiKey) {
    console.warn("OpenAI API key not found");
    throw new Error("OpenAI API key not configured");
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              'You are a helpful assistant that extracts the key information from social media posts. Generate: 1) A clear title (3-8 words), 2) A 1-2 sentence summary of the main content ONLY - ignore any calls to action like "subscribe", "comment", "follow", "like", etc. 3) 1-3 tags that are FACTUAL IDENTIFIERS or CATEGORIES only (e.g., "recipe", "chicken", "javascript", "tutorial", "travel", "italy"). Do NOT use subjective descriptors like "healthy", "amazing", "must-see", "high-protein", etc. Focus on WHAT it is, not opinions about it. Return as JSON: {"title": "...", "description": "...", "tags": ["tag1", "tag2"]}',
          },
          {
            role: "user",
            content: `Extract the main content from this post:\n\n${postContent}\n\nIgnore subscribe/comment/like prompts. Focus only on the actual content.\n\nFor tags, use factual identifiers only. Examples:\n- For a recipe video with chicken: ["recipe", "chicken", "cooking"]\n- For a JavaScript tutorial: ["javascript", "tutorial", "programming"]\n- For travel content in Italy: ["travel", "italy", "photography"]\n\nDo NOT use: "healthy", "amazing", "must-try", "high-protein", "delicious", etc.`,
          },
        ],
        max_tokens: 100,
        temperature: 0.5,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (content) {
      try {
        const parsed = JSON.parse(content);
        return {
          title: parsed.title?.replace(/^["']|["']$/g, "") || null,
          description: parsed.description || null,
          tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 3) : [],
        };
      } catch (parseError) {
        console.error("Failed to parse AI response:", parseError);
        throw parseError;
      }
    }

    throw new Error("No content generated");
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw error;
  }
}

// Generate title and tags using OpenAI
async function generateTitleAndTagsWithAI(
  description: string,
  url: string,
  existingTitle?: string
): Promise<{ title: string | null; tags: string[] }> {
  const config = useRuntimeConfig();
  const apiKey = config.openaiApiKey;

  if (!apiKey) {
    console.warn("OpenAI API key not found");
    return { title: null, tags: [] };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              'You are a helpful assistant that generates concise titles and relevant tags for web links. Return your response as JSON with two fields: "title" (3-8 words, descriptive and clear) and "tags" (array of 1-3 lowercase tags/categories). Tags must be FACTUAL IDENTIFIERS or CATEGORIES only - describe WHAT it is, not opinions about it. Examples: "recipe", "chicken", "pasta", "tutorial", "javascript", "python", "travel", "japan", "photography", "documentation". Do NOT use subjective descriptors like "amazing", "best", "essential", "healthy", "productive", "beautiful", etc.',
          },
          {
            role: "user",
            content: `Generate a title and tags for this link:\n\nURL: ${url}\n${existingTitle ? `Current Title: ${existingTitle}\n` : ""}Description: ${description}\n\nReturn JSON format: {"title": "...", "tags": ["tag1", "tag2"]}\n\nRemember: Tags should be factual categories/identifiers (e.g., "recipe", "chicken", "python", "tutorial"), NOT subjective opinions (e.g., "healthy", "amazing", "best").`,
          },
        ],
        max_tokens: 100,
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (content) {
      try {
        const parsed = JSON.parse(content);
        return {
          title: parsed.title?.replace(/^["']|["']$/g, "") || null,
          tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 3) : [],
        };
      } catch (parseError) {
        console.error("Failed to parse AI response:", parseError);
        return { title: null, tags: [] };
      }
    }

    return { title: null, tags: [] };
  } catch (error) {
    console.error("OpenAI API error:", error);
    return { title: null, tags: [] };
  }
}

// Fallback metadata when fetch fails
function getFallbackMetadata(url: string, urlObj: URL) {
  const isRestrictedSite = [
    "facebook.com",
    "instagram.com",
    "linkedin.com",
    "twitter.com",
    "x.com",
  ].some((domain) => urlObj.hostname.includes(domain));

  return {
    url,
    title: isRestrictedSite
      ? `Link from ${getPlatform(urlObj.hostname)}`
      : `Link: ${urlObj.hostname}`,
    description: isRestrictedSite
      ? "This site requires authentication or blocks automated access"
      : "Unable to fetch metadata for this link",
    image: null,
    siteName: getPlatform(urlObj.hostname),
    platform: getPlatform(urlObj.hostname),
    favicon: `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`,
    suggestedTags: isRestrictedSite ? ["social"] : [],
  };
}

// Helper functions
function extractFullTextContent(html: string, title: string): string {
  // Remove script and style tags
  let cleanHtml = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  cleanHtml = cleanHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  // Try to extract JSON-LD structured data (often contains full content)
  const jsonLdMatch = cleanHtml.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (jsonLdMatch) {
    try {
      const jsonData = JSON.parse(jsonLdMatch[1]);
      if (jsonData.articleBody) {
        return jsonData.articleBody;
      }
      if (jsonData.description) {
        return jsonData.description;
      }
    } catch (e) {
      // JSON parsing failed, continue with other methods
    }
  }

  // Extract text from meta tags that might have more content
  const contentMeta = extractMetaTag(cleanHtml, "description") ||
                      extractMetaTag(cleanHtml, "og:description") ||
                      extractMetaTag(cleanHtml, "twitter:description");

  // Try to find main content areas
  const mainContentMatch = cleanHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                          cleanHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                          cleanHtml.match(/<div[^>]*class=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);

  let extractedText = title;

  if (mainContentMatch) {
    // Extract text from HTML, removing tags
    const contentText = mainContentMatch[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (contentText.length > extractedText.length) {
      extractedText = contentText;
    }
  }

  // If we found content in meta tags that's longer, use that
  if (contentMeta && contentMeta.length > extractedText.length) {
    extractedText = contentMeta;
  }

  // Decode HTML entities
  extractedText = decodeHtmlEntities(extractedText);

  // Limit to 4000 characters to avoid token limits
  return extractedText.substring(0, 4000);
}

function decodeHtmlEntities(text: string): string {
  // First decode numeric entities (both decimal and hex)
  let decoded = text
    // Decode hex entities like &#x27;
    .replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    })
    // Decode decimal entities like &#39; or &#8217;
    .replace(/&#(\d+);/g, (match, dec) => {
      return String.fromCharCode(parseInt(dec, 10));
    });

  // Then decode named entities
  decoded = decoded
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"');

  return decoded;
}

function extractMetaTag(html: string, property: string): string | null {
  // Try Open Graph format
  const ogRegex = new RegExp(
    `<meta\\s+property=["']og:${property.replace(
      "og:",
      ""
    )}["']\\s+content=["']([^"']+)["']`,
    "i"
  );
  // Try Twitter format
  const twitterRegex = new RegExp(
    `<meta\\s+name=["']twitter:${property.replace(
      "twitter:",
      ""
    )}["']\\s+content=["']([^"']+)["']`,
    "i"
  );
  // Try standard meta name format
  const nameRegex = new RegExp(
    `<meta\\s+name=["']${property}["']\\s+content=["']([^"']+)["']`,
    "i"
  );
  // Try reversed attribute order
  const reverseRegex = new RegExp(
    `<meta\\s+content=["']([^"']+)["']\\s+(?:property|name)=["'](?:og:|twitter:)?${property
      .replace("og:", "")
      .replace("twitter:", "")}["']`,
    "i"
  );

  const ogMatch = html.match(ogRegex);
  const twitterMatch = html.match(twitterRegex);
  const nameMatch = html.match(nameRegex);
  const reverseMatch = html.match(reverseRegex);

  const rawValue =
    ogMatch?.[1] ||
    twitterMatch?.[1] ||
    nameMatch?.[1] ||
    reverseMatch?.[1] ||
    null;

  // Decode HTML entities before returning
  return rawValue ? decodeHtmlEntities(rawValue) : null;
}

function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch?.[1] || "Untitled";
}

function getPlatform(hostname: string): string {
  const platforms: Record<string, string> = {
    "youtube.com": "YouTube",
    "youtu.be": "YouTube",
    "twitter.com": "Twitter",
    "x.com": "X (Twitter)",
    "github.com": "GitHub",
    "medium.com": "Medium",
    "dev.to": "DEV Community",
    "reddit.com": "Reddit",
    "linkedin.com": "LinkedIn",
    "facebook.com": "Facebook",
    "instagram.com": "Instagram",
    "tiktok.com": "TikTok",
    "vimeo.com": "Vimeo",
    "twitch.tv": "Twitch",
    "stackoverflow.com": "Stack Overflow",
    "notion.so": "Notion",
    "figma.com": "Figma",
  };

  for (const [domain, platform] of Object.entries(platforms)) {
    if (hostname.includes(domain)) {
      return platform;
    }
  }

  return hostname.replace("www.", "");
}

function generateTags(url: string, title: string, hostname: string): string[] {
  const tags: string[] = [];
  const lowerUrl = url.toLowerCase();
  const lowerTitle = title?.toLowerCase() || "";

  // Platform-based tags
  if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
    tags.push("video");
  }
  if (hostname.includes("github.com")) {
    tags.push("code", "development");
  }
  if (hostname.includes("medium.com") || hostname.includes("dev.to")) {
    tags.push("article", "blog");
  }
  if (hostname.includes("twitter.com") || hostname.includes("x.com")) {
    tags.push("social");
  }
  if (hostname.includes("stackoverflow.com")) {
    tags.push("q&a", "programming");
  }

  // Content-based tags
  const keywords = [
    { patterns: ["tutorial", "guide", "how to", "how-to"], tag: "tutorial" },
    { patterns: ["javascript", "js"], tag: "javascript" },
    { patterns: ["typescript", "ts"], tag: "typescript" },
    { patterns: ["react", "nextjs", "next.js"], tag: "react" },
    { patterns: ["vue", "nuxt"], tag: "vue" },
    { patterns: ["css", "styling"], tag: "css" },
    { patterns: ["design", "ui", "ux"], tag: "design" },
    { patterns: ["api", "rest", "graphql"], tag: "api" },
    { patterns: ["database", "sql", "mongodb"], tag: "database" },
    { patterns: ["ai", "machine learning", "ml"], tag: "ai" },
    { patterns: ["documentation", "docs"], tag: "documentation" },
    { patterns: ["recipe", "cooking", "baking"], tag: "recipe" },
    { patterns: ["travel", "tourism", "destination"], tag: "travel" },
    { patterns: ["photography", "photo"], tag: "photography" },
    { patterns: ["fitness", "workout", "exercise"], tag: "fitness" },
    { patterns: ["music", "song", "album"], tag: "music" },
    { patterns: ["news", "article"], tag: "news" },
    { patterns: ["podcast", "episode"], tag: "podcast" },
  ];

  for (const { patterns, tag } of keywords) {
    if (
      patterns.some(
        (pattern) => lowerUrl.includes(pattern) || lowerTitle.includes(pattern)
      )
    ) {
      if (!tags.includes(tag)) {
        tags.push(tag);
      }
    }
  }

  return tags.slice(0, 5); // Limit to 5 tags
}
